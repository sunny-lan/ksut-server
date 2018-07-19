const UserManager = require('../db/user');
const config = require('../config/index');
const WebSocket = require('ws');
const serializeError = require('serialize-error');
const createClient = require('./client');
const createMessageHandler = require('./message');

const tables = {
    online: 'device-online',
};

module.exports = (ws) => {
    //wrap ws in stuff
    ws.terminate = ws.terminate.bind(ws);
    const _send = ws.send.bind(ws);
    ws.send = (data) => {
        if (ws.readyState === WebSocket.OPEN)
            return _send(JSON.stringify(data));
        else
            ws.terminate();
    };
    function wsExceptionGuard(action) {
        return (...args) => {
            //try to run the action as a promise
            (async () => action(...args))().catch(error => {
                ws.send({
                    //caught errors are sent to the client
                    type: 'error',
                    error: serializeError(error)
                });
                //kill connection on error
                setTimeout(ws.terminate, config.waitTerminate);
            });
            //TODO:handle return values
        };
    }

    //init message, client should check version match
    ws.send({
        type: 'init',
        version: config.version
    });

    //wait for client to login
    ws.once('message', wsExceptionGuard(async data => {
        //check login
        const message = JSON.parse(data);
        if (message.type !== 'login')
            throw new Error('Not logged in');
        const user = await UserManager.login(message.username, message.password);

        //set up commands
        const client = createClient(user, wsExceptionGuard(
            (channel, message) => ws.send({
                type: 'message',
                channel, message,
            })
        ));

        //mark device online
        const {deviceID} = message;
        if (deviceID)
            client.commands.redis.hset(tables.online, deviceID, 1);

        //set up heartbeat
        let countdown = 2;
        ws.on('pong', () => countdown = 2);
        const pingTimer = setInterval(wsExceptionGuard(() => {
            ws.ping();
            if (--countdown <= 0)
                ws.terminate();
        }), config.heartbeat);

        //handle messages from user
        const messageHandler = createMessageHandler(client, ws.send);
        ws.on('message', wsExceptionGuard(data => messageHandler(JSON.parse(data))));

        //tell user they were successful
        ws.send({type: 'loginSuccess'});

        //clean up on disconnect
        ws.on('close', () => {
            //stop pinging
            clearInterval(pingTimer);
            //mark device offline
            if (deviceID)
                client.commands.redis.hset(tables.online, deviceID, 0);
            //clean up redis
            client.quit();
        });
    }));
};