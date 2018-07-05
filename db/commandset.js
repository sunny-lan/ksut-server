function namespace(namespace,name) {
    return namespace+':'+name;
}

function denamespace(value){
    //TODO make more efficient
    return value.split(':').slice(1).join(':');
}

//maps user availible calls to redis calls with namespacing
class CommandSet {
    constructor(userID) {
        this._ns = name => namespace(userID, name);
    }

    //protects whole array
    _arrayMapper(array) {
        return array.map(name => this._ns(name));
    }

    //protects whole array, forces array to be >1 length
    _nonEmptyMapper(first, ...rest) {
        return [this._ns(first), this._arrayMapper(rest)];
    }
}

class WriteCommandSet extends CommandSet {
    //TODO expiration
    set(key, value) {
        return [this._ns(key), value];
    }
}

class ReadCommandSet extends CommandSet {
    get(key) {
        return [this._ns(key)];
    }
}

class PubSubCommandSet extends CommandSet {
    subscribe(channel, ...channels) {
        return this._nonEmptyMapper(channel, channels);
    }

    publish(channel, message) {
        return [this._ns(channel), message];
    }
}

module.exports = {
    namespace,
    denamespace,
    ReadCommandSet,
    WriteCommandSet,
    PubSubCommandSet,
};