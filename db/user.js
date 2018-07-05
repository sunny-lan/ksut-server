const { db } = require('./db');
const { Client, ClientManager } = require('./client');

const tables = {
    username: 'username-user'
};

const UserManager = {
    async add(name) {
        const client = await ClientManager.add(name);
        const id = client.id;
        await db.hset(tables.username, name, id);
        return new User(id);
    }
};

class User extends Client {
    setName() {
        throw new Error('Cannot set username');
    }

    async del() {
        await Promise.all([
            super.del(),
            this.getName().then(name => db.hdel(tables.username, name))
        ]);
    }
}

module.exports.UserManager = UserManager;
module.exports.User = User;