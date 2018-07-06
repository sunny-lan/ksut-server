function namespace(namespace, name) {
    return namespace + ':' + name;
}

function denamespace(value) {
    //TODO make more efficient
    return value.split(':').slice(1).join(':');
}

//maps user availible calls to redis calls with namespacing
class NamespacedSet {
    constructor(user, wrapper) {
        function namespacer(key) {
            return namespace(user.id, key);
        }

        //wrap all methods
        for (const memberName in Object.getOwnPropertyNames(this.constructor.prototype)) {
            const member = this[memberName];
            if (typeof member === 'function') {
                this[member] = (...args) => member(namespacer, ...args);
                if (wrapper)
                    this[member] = wrapper(member, memberName);
            }
        }
    }
}

class WriteSet extends NamespacedSet {
    //TODO expiration
    set(ns, key, value) {
        return [ns(key), value];
    }
}

class ReadSet extends NamespacedSet {
    get(ns, key) {
        return [ns(key)];
    }
}

class PubSubSet extends NamespacedSet {
    subscribe(ns, channel, ...channels) {
        return [ns(channel), ...channels.map(ns)];
    }

    publish(ns, channel, message) {
        return [ns(channel), message];
    }
}

module.exports = {
    namespace,
    denamespace,
    ReadSet,
    WriteSet,
    PubSubSet,
};