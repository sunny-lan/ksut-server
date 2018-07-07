const passwordHash = require('password-hash');
const uuid = require('uuid/v4');
const {db} = require('./db');
const config = require('../config');

const tables = {
    password: 'user-password',
    loginID: 'username-user',
    username: 'user-username',
};

const UserManager = {
    async add(username, password) {
        if (await db.hexistsAsync(tables.loginID, username))
            throw new Error('username is taken');
        const added = new User(uuid());
        await Promise.all([
            added.setPassword(password),
            db.hsetAsync(tables.username, added.id, username), //username
            db.hsetAsync(tables.loginID, username, added.id) //login table
        ]);
        return added;
    },

    async login(username, password) {
        const id = await db.hgetAsync(tables.loginID, username);
        if (id) {
            const hash = await db.hgetAsync(tables.password, id);
            if (passwordHash.verify(password, hash))
                return new User(id);
        }
        throw new Error('Invalid login');
    },
};

//this runs the first time server is started
async function initDB() {
    if (await db.getAsync('ranBefore')) return;
    console.log('First time running, resetting database...');
    await db.flushdbAsync();
    await Promise.all([
        db.setAsync('ranBefore', true),
        UserManager.add(config.adminUsername, config.defaultAdminPassword),
    ]);
    console.log('success')
}
initDB().catch(error => console.error('failed initializing db', error));

class User {
    constructor(id) {
        this.id = id;
    }

    async setPassword(password) {
        await db.hsetAsync(tables.password, this.id, passwordHash.generate(password));
    }

    async getUsername() {
        return db.hgetAsync(tables.username, this.id);
    }

    async del() {
        await Promise.all([
            db.hdelAsync(tables.password, this.id), //password
            this.getUsername().then(name => Promise.all([
                db.hdelAsync(tables.loginID, name), //login table
                db.hdelAsync(tables.username, this.id) //name table
            ])),
        ]);
    }
}

module.exports = UserManager;