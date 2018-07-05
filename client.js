const redis = require('redis');
const { version, heartbeat } = require('./config');
const serializeError = require('serialize-error');

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

    ws.once('message', wsExceptionGuard(ws, data => {
        
        //set up heartbeat
        ws.isAlive = true;
        ws.on('pong', () => ws.isAlive = true)
        const pingTimer = setInterval(() => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        }, heartbeat);

        //handle messages from client
        ws.on('message', wsExceptionGuard(ws, data => {
            const message = JSON.parse(data);
            
        }));

        //clean up on disconnect
        ws.on('disconnect', () => {
            clearInterval(pingTimer);
        });
    }));
};