const specs = require('./specs');
const { db } = require('../db');

function namespace(space, name) {
    return `${space}:${name}`;
}

function denamespace(namespaced) {
    return namespaced.substring(namespaced.indexOf(':') + 1);
}

function wrapAll(spec, wrapper) {
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
                result = resultMapper(denamespace, result);
            return result;
        };
    };
}

function createWrapped(sub, user) {
    function namespacer(name) {
        return namespace(user.id, name);
    }
    const commands = Object.assign({},
        wrapAll(Object.assign({}, specs.read, specs.pub), makeAPIWrapper(db, namespacer)),
        //TODO denamespace result
        wrapAll(specs.sub, makeAPIWrapper(sub, namespacer)),
        wrapAll(specs.write, (argNumber, command) => {
            const apiCall = db[command + 'Async'].bind(db);
            return (...args) => {
                commands.publish(namespace('write', args[argNumber]), JSON.stringify({
                    command,
                    args
                })).catch(error => console.warn('could not publish write', error));
                args[argNumber] = namespacer(args[argNumber]);
                return apiCall(...args);
            };
        }),
    );

    return commands;
}

module.exports = createWrapped;