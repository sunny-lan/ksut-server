const { db } = require('./db');
const uuidv4 = require('uuid/v4');

const tables = {
    name: 'entity-name'
};

const EntityManager = {
    async add(name) {
        const id = uuidv4();
        const added = new Entity(id);
        if (name)
            await added.setName(name);
        return added;
    }
};

class Entity {
    constructor(id) {
        this.id = id;
    }

    async setName(name) {
        await db.hset(tables.name, this.id, name);
    }

    async getName() {
        return db.hget(tables.name, this.id);
    }

    async del() {
        await db.hdel(tables.name, this.id);
    }
}

module.exports.EntityManager = EntityManager;

module.exports.Entity = Entity;