const UserManager = require('./db/user');
const config = require('./config');
const {getName, getNamespace} = require('./command/namespace');
const WebSocket = require('ws');
const serializeError = require('serialize-error');
const createClient = require('./client');

const tables = {
    online: 'device-online',
};

module.exports = (ws) => {
    const _send = ws.send.bind(ws);
    ws.send = (...args) => {
        if (ws.readyState === WebSocket.OPEN)
            return _send(...args);
        else
            ws.terminate();
    };
    function wsExceptionGuard(action) {
        return (...args) => {
            //try to run the action as a promise
            (async () => action(...args))().catch(error => {
                ws.send(JSON.stringify({
                    //caught errors are sent to the client
                    type: 'error',
                    error: serializeError(error)
                }));
            });
            //TODO:handle return values
        };
    }

    //init message, client should check version match
    ws.send(JSON.stringify({
        type: 'init',
        version: config.version
    }));

    //wait for client to login
    ws.once('message', wsExceptionGuard(async data => {
        //check login
        const message = JSON.parse(data);
        if (message.type !== 'login')
            throw new Error('Not logged in');
        let user;
        try {
            user = await UserManager.login(message.username, message.password);
        } catch (error) {
            setTimeout(ws.terminate, config.waitTerminate);
            throw error;
        }

        //set up commands
        const client = createClient(user, wsExceptionGuard(
            (channel, message) => {
                ws.send(JSON.stringify({
                    type: 'message',
                    channel, message,
                }));
            }
        ));
        const commands = client.commands;

        //mark device online
        const {deviceID} = message;
        if (deviceID)
            commands.redis.hincrby(tables.online, deviceID, 1);

        //set up heartbeat
        ws.isAlive = true;
        ws.on('pong', () => ws.isAlive = true);
        const pingTimer = setInterval(() => {
            try {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
                ws.ping();
            } catch (error) {
                ws.terminate();
            }
        }, config.heartbeat);

        //tell user they were successful
        ws.send(JSON.stringify({type: 'loginSuccess'}));

        //handle messages from user
        ws.on('message', wsExceptionGuard(async data => {
            const message = JSON.parse(data);
            if (message.type === 'command') {
                //run command and send back response
                let response = {
                    type: 'commandResponse',
                    id: message.id,
                };
                try {
                    let command;
                    try {
                        command = commands[getNamespace(message.command)][getName(message.command)];
                        if (command === undefined)
                            throw new Error();
                    } catch (error) {
                        throw new Error('Invalid command:', message.command);
                    }
                    response.result = await command(...message.args);
                    response.subType = 'result';
                } catch (error) {
                    response.subType = 'error';
                    response.error = serializeError(error);
                }
                ws.send(JSON.stringify(response));
            } else
                throw new Error('Invalid message type');
        }));

        //clean up on disconnect
        ws.on('close', () => {
            //stop pinging
            clearInterval(pingTimer);
            //mark device offline
            if (deviceID)
                commands.redis.hincrby(tables.online, deviceID, -1);
            //clean up redis
            client.quit();
        });
    }));
};