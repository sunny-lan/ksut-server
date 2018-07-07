const { UserManager } = require('./db/user');
const config = require('./config');
const { create } = require('./db');
const createWrapped = require('./command/wrap');
const { isHeroku } = require('./config/dev');
let serializeError;
if (!isHeroku())
    serializeError = require('serialize-error');

function wsExceptionGuard(ws, action) {
    return (...args) => {
        //try to run the action as a promise
        Promise.resolve(action(...args)).catch(
            error => ws.send(JSON.stringify({
                //caught errors are sent to the client
                type: 'error',
                error: serializeError ? serializeError(error) : error.message
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
        sub.on('message', (channel, message) => ws.send(JSON.stringify({
            type: 'message',
            channel,
            message: JSON.parse(message),
        })));

        //create command set
        const commands = createWrapped(sub, user);

        //handle messages from user
        ws.on('message', wsExceptionGuard(ws, async data => {
            const message = JSON.parse(data);
            if (message.type === 'command') {
                //run command and send back response
                ws.send(JSON.stringify({
                    type: 'messageResponse',
                    id: message.id,
                    response: await commands[message.command](...message.args),
                }));
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