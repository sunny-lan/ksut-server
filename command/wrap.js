const {getName, namespace, getNamespace} = require('./namespace');

function makeEndpoint(instance, async) {
    const staticFuncs = Object.getPrototypeOf(instance).constructor;
    return async message => {
        let command = message.command;
        if (command.startsWith('_'))
            throw new Error("Private commands cannot be called");
        if (async) command += 'Async';
        if (instance[command])
            message.result = await instance[command](...message.args);
        else if (staticFuncs[command])
            message.result = await staticFuncs[command](...message.args);
        else
            throw new Error("Command doesn't exist");
        return message;
    };
}

function makeNamespaced(namespaces) {
    return message => {
        const namespace = getNamespace(message.command);
        if (!namespaces[namespace])
            throw new Error('Invalid namespace');
        message.command = getName(message.command);
        return namespaces[namespace](message);
    };
}

function makeSpeced(spec, specParser) {
    const parsed = {};
    const parseType = typeof specParser === 'object';
    Object.keys(spec).forEach(
        section => Object.keys(spec[section]).forEach(
            command => {
                let parseFunc = specParser;
                if (parseType)
                    parseFunc = parseFunc[section];
                parsed[command] = parseFunc(spec[section][command])
            }
        )
    );
    return message => {
        if (!parsed[message.command])
            throw new Error('Invalid command' + JSON.stringify(message));
        return parsed[message.command](message);
    };
}

module.exports = {
    makeEndpoint,
    makeSpeced,
    makeNamespaced,
};
