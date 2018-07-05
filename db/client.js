const uuidv4 = require('uuid/v4');
const { db, create } = require('./db');
const { denamespace, namespace, ReadCommandSet, PubSubCommandSet, WriteCommandSet } = require('./commandset');

const tables = {
    owner: 'client-owner',
    clients: user => `${user}-client`,
    name: 'entity-name'
};

const ClientManager = {
    _cache: {},

    async add(...args) {
        this._add(uuidv4(), ...args);
    },

    async _add(id, name, owner) {
        const added = new Client(id);
        if (!owner) owner = added; //owner defaults to itself
        await Promise.all([
            name && added.setName(name), //TODO check this
            db.hset(tables.owner, id, owner.id), //owner
            db.sadd(tables.clients(owner.id), id), //client list
        ]);
        return added;
    },

    async list(owner) {
        return db.smembers(tables.kusts(owner.id));
    },
};

class Client {
    constructor(id, subListener) {
        this.id = id;
        this.owner = this.getOwner();
        this._sub = create();
        this._sub.on('message', (channel, message) => subListener(denamespace(channel), message));
        this.commands = this._generateCommands();
    }

    async _generateCommands() {
        const owner = await this.owner;
        //each command set is wrapped differently then combined
        return Object.assign(
            this._wrapCommandSet(new WriteCommandSet(owner), this._wrapWritePipe),
            this._wrapCommandSet(new ReadCommandSet(owner), command => db[command]),
            this._wrapCommandSet(new PubSubCommandSet(owner), command => this._sub[command]),
        );
    }

    _wrapWritePipe(command) {
        return (...args) => {
            //pipe db updates to its own channel so clients can live update
            this.commandSet.publish(namespace(this.id, 'writes'), JSON.stringify({ command, args }));
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

    async setName(name) {
        await db.hset(tables.name, this.id, name);
    }

    async getName() {
        return db.hget(tables.name, this.id);
    }

    async del() {
        await Promise.all([
            await db.hdel(tables.name, this.id), //name
            (async () => { //delete from owner list first
                await db.srem(tables.kusts(await this.getOwner()));
                await db.hdel(tables.owner, this.id);//then remove owner entry
            })()
        ]);
    }

    async quit() {
        await this._sub.quit();
    }
}

module.exports.ClientManager = ClientManager;
module.exports.Client = Client;