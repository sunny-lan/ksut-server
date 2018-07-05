const { db } = require('./db');
const { EntityManager, Entity } = require('./entity');
const passwordHash = require('password-hash');

const tables = {
    password: 'client-password',
};

const ClientManager = {
    async add(password) {
        const entity = await EntityManager.add();
        const id = entity.id;
        const added = new Client(id);
        await added.setPassword(password);
        return added;
    },

    async login(id, password) {
        if (passwordHash.verify(password, await db.hget(tables.password, id)))
            return new Client(id);
        throw new Error('Invalid login');
    }
};

class Client extends Entity {
    async setPassword(password) {
        await db.hset(tables.password, this.id, passwordHash.generate(password));
    }

    async del() {
        await Promise.all([
            db.hdel(tables.password, this.id),
            super.del()
        ]);
    }
}

module.exports.ClientManager = ClientManager;
module.exports.Client = Client;