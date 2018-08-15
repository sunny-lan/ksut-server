const config = require('../config');
const {extract} = require('../util');

const deserializeError = require('deserialize-error');
const EventEmitter = require('events');

function createCommandWaiter(send, error) {
    //keep track of running commands (their resolve and reject functions)
    const openPromises = {};
    let counter = 0;
    return {
        quit(reason){
            reason = reason || new Error('Connection terminated');
            Object.keys(openPromises).forEach(
                id => openPromises[id].reject(reason)
            );
        },

        receive(response) {
            if (!openPromises[response.id])
                return; //already got rejected/accepted
            //when server responds, close the corresponding promise
            if (response.subType === 'result') {
                openPromises[response.id].resolve(response.result);
                delete openPromises[response.id];
            }
            else if (response.subType === 'error') {
                openPromises[response.id].reject(deserializeError(response.error));
                delete openPromises[response.id];
            }
            else
                error(new Error('Could not understand server message response'));
        },

        send(command) {
            //give this command an id
            const thisID = '#' + counter;
            counter++;

            //actually send command
            send({
                type: 'command',
                ...command,
                id: thisID
            });

            //wait for result as promise
            return new Promise((resolve, reject) => {
                //store promise in list of pendingText commands
                openPromises[thisID] = {resolve, reject};

                //cancel command if it hasn't been responded to for a long time
                //TODO command timeout extensions
                setTimeout(() => {
                    delete openPromises[thisID];
                    reject(new Error('Command timed out'));
                }, config.timeout);
            });
        }
    };
}

function makeClient(send, heartbeat) {
    const quitEmitter = new EventEmitter(), emitter = new EventEmitter();
    emitter.once('error', error => quitEmitter.emit('quit', error));

    const waiter = createCommandWaiter(send, error => emitter.emit('error', error), config);
    quitEmitter.once('quit', waiter.quit);

    if (heartbeat) {
        async function sendBeat() {
            const response = waiter.send({
                command: 'good:vibrations',
                args: [false],
            });
            if (response !== '1.129848')
                throw new Error('tinkle tinkle hoy');
        }

        //set up heartbeat
        const pingTimer = setInterval(() => {
            let _callback;
            Promise.race([
                sendBeat,
                new Promise(resolve => quitEmitter.on('quit', _callback = resolve)),
            ]).catch(error => emitter.emit('error', error)).finally(() => {
                if (_callback)
                    quitEmitter.removeListener('quit', _callback)
            });

        }, config.timeout);

        quitEmitter.once('quit', () => clearInterval(pingTimer));
    }

    return {
        receive(data){
            if (data.type === 'commandResponse')
                waiter.receive(data);
            else
                emitter.emit('message', data)
        },
        send: waiter.send,

        s(command, ...args){
            return waiter.send({command, args});
        },

        quit(reason){
            quitEmitter.emit('quit', reason);
        },

        ...extract(emitter),
    };
}

module.exports = makeClient;