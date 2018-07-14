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
    Object.getOwnPropertyNames(Object.getPrototypeOf(instance))
        .filter(key => !key.startsWith('_') && typeof instance[key] === 'function')//filter out private and non function 
        .forEach(key => result[key] = instance[key].bind(instance)); //bind all functions
    return result;
}

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
                commands.publish(namespace('write', args[argNumber]), {command, args})
                    .catch(error => console.warn('could not publish write', error));
                args[argNumber] = namespacer(args[argNumber]);
                return apiCall(...args);
            };
        }),
    );

    return commands;
}

module.exports = {
    createWrapped,
    extractClassCommands,
};