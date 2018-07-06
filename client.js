const serializeError = require('serialize-error');
const { UserManager } = require('./user');
const { version, heartbeat } = require('./config');
const { ReadSet, WriteSet, PubSubSet, namespace } = require('./namespacing');
const { wrap } = require('./commandset');
const { db, create } = require('./db');

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

        const sub = create();

        //set up command handler
        const commands = Object.assign(
            wrap(new WriteSet(user, writePipeWrapper), db),
            wrap(new ReadSet(user), db),
            wrap(new PubSubSet(user), sub),
        );

        //pipe db updates to its own channel so clients can live update
        function writePipeWrapper(command, commandName) {
            return (ns, ...args) => {
                function nsReplacement(key) {
                    commands.publish(namespace('write', key), JSON.stringify({
                        command: commandName,
                        args
                    }));
                    return ns(key);
                }
                return command(nsReplacement, ...args);
            };
        }

        //handle messages from user
        ws.on('message', wsExceptionGuard(ws, data => {
            const message = JSON.parse(data);
            if (message.type === 'command') {
                commands[message.command](...message.args);
            } else
                throw new Error('Invalid message type');
        }));

        //clean up on disconnect
        ws.on('disconnect', () => {
            clearInterval(pingTimer);
        });
    }));
};