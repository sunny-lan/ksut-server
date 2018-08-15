function get(obj, ...keys) {
    for (let i = 0; i < keys.length; i++) {
        if (obj === undefined)return obj;
        if (keys[i] === undefined)return undefined;
        obj = obj[keys[i]];
    }
    return obj;
}

function coalesce(...args) {
    for (let i = 0; i < args.length; i++)
        if (args[i] !== undefined)
            return args[i];
}

function wait(delay) {
    return new Promise(resolve => setTimeout(resolve, delay));
}

function convertRedisRange(stop) {
    if (stop === -1)return undefined;
    return stop + 1;
}

function extract(emitter) {
    return {
        on: emitter.on.bind(emitter),
        once: emitter.once.bind(emitter),
    };
}

function together(...funcs) {
    return (...args) => funcs.map(func => func(...args));
}

const utils = {
    extract, convertRedisRange, wait, coalesce, get,
    together
};

module.exports = utils;