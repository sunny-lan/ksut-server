const {VM} = require('vm2');
const createClient = require('./client');
const EventEmitter = require('events');

function createVM(user) {
    const emitter = new EventEmitter();
    const client = createClient(user, (...args) => emitter.emit('message', ...args));
    return new VM({
        //todo add timeout && detect when script done running
        sandbox: {
            on: emitter.on.bind(emitter),
            ksut: client.commands,
        }
    });
}

const vmCache = {};

module.exports = (user) => {
    if (!vmCache[user.id])
        vmCache[user.id] = createVM(user);
    return vmCache[user.id];
};