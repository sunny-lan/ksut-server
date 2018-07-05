const { version, heartbeat } = require('./config');
const serializeError = require('serialize-error');
const { UserManager } = require('../db/user');
const { ClientManager } = require('../db/client');

function wsExceptionGuard(ws, action) {
    return (...args) => {
        try {
            action(...args);
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'error',
                error: serializeError(error)
            }));
        }
    };
}

module.exports = (ws) => {
    ws.send(JSON.stringify({
        type: 'init',
        version
    }));

    //wait for login message
    ws.once('message', wsExceptionGuard(ws, data => {
        const message = JSON.parse(data);
        if (message.type !== 'login')
            throw new Error('Not logged in');
        const user = UserManager.login(message.username, message.password);

        //set up heartbeat
        ws.isAlive = true;
        ws.on('pong', () => ws.isAlive = true);
        const pingTimer = setInterval(() => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        }, heartbeat);

        //handle messages from user
        ws.on('message', wsExceptionGuard(ws, data => {
            const message = JSON.parse(data);
            if (message.type === 'command') {
                handleCommand(message);
            } else
                throw new Error('Invalid message type');
        }));

        const clientCache = {};
        function get(id) {
            if (!clientCache[id]) {
                clientCache[id] = new ClientManager(id, (channel, message)=>{
                    ws.send();
                });
            }
            return clientCache[id];
        }

        async function handleCommand(message) {
            //actually call command
            const commandFunction = get(message.source).commands[message.command];
            const result = await commandFunction(...message.args);
            //send result
            ws.send(JSON.stringify({
                type: 'result',
                id: message.id,//optional id to track response
                result,
            }));
        }

        //clean up on disconnect
        ws.on('disconnect', () => {
            clearInterval(pingTimer);
            Promise.all(Object.keys(clientCache).map(clientID => clientCache[clientID].quit()));
        });
    }));
};