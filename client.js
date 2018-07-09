const UserManager = require('./db/user');
const ScriptManager = require('./db/script');
const config = require('./config');
const { create } = require('./db');
const { createWrapped, extractClassCommands } = require('./command/wrap');
const { isHeroku } = require('./config/dev');
const { getName, getNamespace } = require('./command/namespace');

let serializeError;
if (isHeroku())
    serializeError = error => error.message;
else
    serializeError = error => { console.error(error); return error.message; };

function wsExceptionGuard(ws, action) {
    return (...args) => {
        //try to run the action as a promise
        (async () => action(...args))().catch(
            error => ws.send(JSON.stringify({
                //caught errors are sent to the client
                type: 'error',
                error: serializeError(error)
            }))
        );
        //TODO:handle return values
    };
}

module.exports = (ws) => {
    //init message, client should check version match
    ws.send(JSON.stringify({
        type: 'init',
        version: config.version
    }));

    //wait for client to login
    ws.once('message', wsExceptionGuard(ws, async data => {
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

        //tell user they were successful
        ws.send(JSON.stringify({ type: 'loginSuccess' }));

        //set up heartbeat
        ws.isAlive = true;
        ws.on('pong', () => ws.isAlive = true);
        const pingTimer = setInterval(() => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            try { ws.ping(); } catch (error) { ws.terminate(); }
        }, config.heartbeat);

        //create redis client for this subscriber
        const sub = create();
        sub.on('message', wsExceptionGuard(ws, (channel, message) => ws.send(JSON.stringify({
            type: 'message',
            channel: getName(channel),
            message: JSON.parse(message),
        }))));

        //create command set
        const commands = {
            redis: createWrapped(sub, user),
            user: extractClassCommands(user),
        };
        commands.script = extractClassCommands(new ScriptManager(commands));
        commands.goodVibrations = (god) => {
            if (god)
                throw new Error('tinkle hoy');
            else
                return '1.129848';
        };

        //handle messages from user
        ws.on('message', wsExceptionGuard(ws, async data => {
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
                        if (message.command.includes(':'))
                            command = commands[getNamespace(message.command)][getName(message.command)];
                        else
                            command = commands[message.command];
                        if (command === undefined)
                            throw new Error();
                    } catch (error) {
                        throw new Error('Invalid command ' + JSON.stringify(message));
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
        ws.on('disconnect', () => {
            clearInterval(pingTimer);
            sub.quit();
        });
    }));
};