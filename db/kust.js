const { db, create } = require('./db');
const { Client, ClientManager } = require('./client');

const tables = {
    owner: 'kust-owner',
    kusts: user => `${user}-kusts`
};

const KustManager = {
    async add(owner, password) {
        const client = await ClientManager.add(password);
        const id = client.id;
        await Promise.all([
            db.hset(tables.owner, id, owner.id),
            db.sadd(tables.kusts(owner.id), id)
        ]);
        return new Kust(id);
    },

    async list(owner) {
        return db.smembers(tables.kusts(owner.id));
    }
};

function namespace(...args) {
    return args.join(':');
}

//maps user availible calls to redis calls with namespacing
class CommandSet {
    constructor(userID) {
        this._ns = (...args) => namespace(userID, ...args);
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

    publish(channel, message){
        return [this._ns(channel), message];
    }
}

class Kust extends Client {
    constructor(id) {
        super(id);
        this.owner = this.getOwner();
        this.commands = (async () => {
            const owner = await this.owner;
            //each command set is wrapped differently then combined
            return Object.assign(
                this._wrapCommandSet(new WriteCommandSet(owner), this._wrapWriteConnector),
                this._wrapCommandSet(new ReadCommandSet(owner), command => db[command]),
                this._wrapCommandSet(new PubSubCommandSet(owner), command => this._sub()[command]),
            );
        })();
    }

    _wrapWriteConnector(command) {
        return (...args) => {
            //pipe to 'writes' channel so clients can live update
            this._sub().publish(namespace(this.id, 'writes'), JSON.stringify({ command, args }));
            return db[command](...args);
        };
    }

    _wrapCommandSet(commandSet, wrapper) {
        return Object.keys(commandSet)//look through original command set
            .filter(command => !command.startsWith('_'))//filter out private commands
            .reduce((wrappedSet, command) => {
                //for each command, wrap it up in the CommandSet
                const wrapped = wrapper(command);
                wrappedSet[command] = (...args) => wrapped(commandSet[command](...args));
                return wrappedSet;
            }, {});
    }

    async getOwner() {
        return db.hget(tables.owner, this.id);
    }

    async del() {
        await Promise.all([
            super.del(),
            (async () => {
                await db.srem(tables.kusts(await this.getOwner()));
                await db.hdel(tables.owner, this.id);
            })()
        ]);
    }

    _sub() {
        if (!this._cache_sub)
            this._cache_sub = create();
        return this._cache_sub;
    }
}

module.exports.KustManager = KustManager;
module.exports.Kust = Kust;