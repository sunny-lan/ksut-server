const passwordHash = require('password-hash');
const { db } = require('./db');
const { Client, ClientManager } = require('./client');

const tables = {
    password: 'user-password',
    username: 'username-user'
};

const UserManager = {
    add: ClientManager.add, //TODO sketchy extend

    async _add(id, name, password) {
        const added = new User(id);
        await Promise.all([
            ClientManager.add(id, name, password),
            added.setPassword(password),
            db.hset(tables.username, name, id) //username
        ]);
        return added;
    },    

    async login(id, password) {
        const passwordHash = await db.hget(tables.password, id);
        if (passwordHash.verify(password, passwordHash))
            return new User(id);
        throw new Error('Invalid login');
    },
};

class User extends Client {
    setName() {
        throw new Error('Cannot set username');
    }

    async setPassword(password) {
        await db.hset(tables.password, this.id, passwordHash.generate(password));
    }

    async delete() {
        await Promise.all([
            super.delete(),
            db.hdel(tables.password, this.id), //password
            this.getName().then(name => db.hdel(tables.username, name))
        ]);
    }
    
}

module.exports.UserManager = UserManager;
module.exports.User = User;