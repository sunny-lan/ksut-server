const UserManager = require('../command/user');
const config = require('../config/index');
const WebSocket = require('ws');
const serializeError = require('serialize-error');
const {createClient} = require('./client');
const createMessageHandler = require('./messageServer');
const handleError = require('../error');
const {guard} = require('../util');

const tables = {
    online: 'device-online',
};

module.exports = (ws) => {
    let client;

    function guardClient(callback) {
        return guard(callback, error => {
            send({
                type: 'error',
                error: serializeError(error),
            });
            setTimeout(ws.terminate, config.waitTerminate);
        });
    }

    function guardServer(callback, log) {
        return guard(callback, error => {
            if (log)
                handleError(error);
            ws.terminate();
        });
    }
let deviceID;
    //wrap ws in stuff
    ws.terminate = ws.terminate.bind(ws);
    const send = guardServer(data => {
        if (deviceID)
        console.log('send ', data);
        if (ws.readyState === WebSocket.OPEN)
            return ws.send(JSON.stringify(data));
        else
            ws.terminate();
    });

    //init message, client should check version match
    send({
        type: 'init',
        version: config.version
    });

    //wait for client to login
    ws.once('message', guardClient(async data => {
        //check login
        const message = JSON.parse(data);
        if (message.type !== 'login')
            throw new Error('Not logged in');
        const user = await UserManager.login(message.username, message.password);

        //set up commands
        client = createClient(user);
        client.once('error', handleError);
        client.on('message', message=>send({...message,type:'message'}));

        //TODO use better heartbeat
        const heartbeat = guardServer(() => {
            ws.ping();
            function resolve() {
                clearTimeout(timeout);
                setTimeout(heartbeat, config.timeout);
            }

            ws.once('pong', resolve);
            const timeout = setTimeout(function reject() {
                ws.removeListener('pong', resolve);
                ws.terminate();
            }, config.timeout);
        });
        heartbeat();

        //mark device online
        deviceID = message.deviceID;
        if (deviceID)
            await client.s('redis:hset', tables.online, deviceID, 1);

        //handle messages from user
        const messageHandler = createMessageHandler(client, send);
        ws.on('message', guardClient(data => {
            if (deviceID)
            console.log('recv ', data);
            messageHandler(JSON.parse(data));
        }));

        //clean up on disconnect
        ws.once('close', guardServer(async () => {
            //mark device offline
            if (deviceID)
                await client.s('redis:hset', tables.online, deviceID, 0);
        }, true));

        //tell user they were successful
        send({type: 'loginSuccess'});
    }));

    //clean up on disconnect
    ws.once('close', guardServer(() => {
        //clean up redis
        if (client)
            client.quit();
    }));
};