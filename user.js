const passwordHash = require('password-hash');
const uuid=require('uuid/v4');
const { db } = require('./db');

const tables = {
    password: 'user-password',
    username: 'username-user'
};

const UserManager = {
    async add( name, password) {

        const added = new User(uuid());
        await Promise.all([
            added.setPassword(password),
            db.hset(tables.username, name, added.id) //username
        ]);
        return added;
    },    

    async login(username, password) {
        const passwordHash = await db.hget(tables.password, username);
        if (passwordHash.verify(password, passwordHash))
            return new User(username);
        throw new Error('Invalid login');
    },
};

class User {
    constructor(id){
        this.id=id;
    }

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