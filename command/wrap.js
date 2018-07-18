const {getName, namespace} = require('./namespace');

const specs = require('./specs');
const {db} = require('../db');

function wrapSpec(spec, wrapper) {
    return Object.keys(spec).reduce((output, command) => {
        output[command] = wrapper(spec[command], command);
        return output;
    }, {});
}

function makeAPIWrapper(api, namespacer) {
    return function apiWrapper(mapper, command) {
        let argMapper, resultMapper;
        if (typeof mapper === 'function')
            argMapper = mapper;
        else
            [argMapper, resultMapper] = mapper;

        return async (...args) => {
            let result = await api[command + 'Async'](argMapper(namespacer, ...args));
            if (resultMapper)
                result = resultMapper(getName, result);
            return result;
        };
    };
}

function extractClassCommands(instance) {
    const result = {};
    let input = instance;
    if (typeof instance === 'object')
        input = Object.getPrototypeOf(input);
    Object.getOwnPropertyNames(input).filter(key => !key.startsWith('_') && typeof instance[key] === 'function' && key !== 'constructor')//filter out private and non function
        .forEach(key => {
            result[key] = instance[key];
            if (typeof  instance === 'object')
                result[key] = result[key].bind(instance)
        }); //bind all functions
    return result;
}

//TODO move this to client.js
function createWrapped(sub, user) {
    function namespacer(name) {
        return namespace(user.id, name);
    }

    const commands = Object.assign({},
        wrapSpec(Object.assign({}, specs.read, specs.pub), makeAPIWrapper(db, namespacer)),
        wrapSpec(specs.sub, makeAPIWrapper(sub, namespacer)),
        wrapSpec(specs.write, (argNumber, command) => {
            const apiCall = db[command + 'Async'].bind(db);
            return (...args) => {
                let publish = commands.publish(namespace('write', args[argNumber]), {command, args});
                args[argNumber] = namespacer(args[argNumber]);
                return Promise.all([apiCall(...args), publish]);
            };
        }),
    );

    return commands;
}

module.exports = {
    createWrapped,
    extractClassCommands,
};