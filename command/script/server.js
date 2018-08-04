const {db} = require('../../db');
const tables = require('./tables');
const {VM} = require('vm2');
const clientCreator = require('../../client/client');
const EventEmitter = require('events');
const UserManager = require('../user');
const exitHook = require('async-exit-hook');

const running = {};

class ServerScriptManager {
    constructor(client) {
        this._c = client;
    }

    static async run(instanceID, info) {
        if (running[instanceID] || (!await db.sismemberAsync(tables.unstarted, instanceID)))
            throw new Error('Script is already running');
        if (!info) {
            info = JSON.parse(await db.hgetAsync(tables.startInfo, instanceID));
            info.owner = UserManager.get(info.owner);
        }
        const emitter = new EventEmitter();
        const client = clientCreator.createClient(info.owner, (...args) => emitter.emit('message', ...args));
        new VM({
            //todo add timeout & detect when script done running
            sandbox: {
                ksut: {
                    on: emitter.on.bind(emitter),
                    send: client.send,
                    s: client.s,
                },
            }
        }).run(await db.hgetAsync(tables.server, info.scriptID));
        running[instanceID] = client;
        await db.sremAsync(tables.unstarted, info.scriptID);
    }

    static async init() {
        exitHook(done => {
            Promise.all(Object.keys(running).forEach(ServerScriptManager.kill))
                .then(() => console.log('successfully exited'))
                .catch(console.error)
                .then(done)
        });
        const unstarted = (await db.smembersAsync(tables.unstarted)) || [];
        await Promise.all(unstarted.map(ServerScriptManager.run));
    }

    static async kill(instanceID){
        running[instanceID].quit();
        delete running[instanceID];
        await db.saddAsync(tables.unstarted, instanceID);
    }

    async instantiate(instanceID, scriptID) {
        if (!await db.
            hexistsAsync(tables.server, scriptID))
            return;
        const startInfo = {
            owner: this._c.user.id,
            scriptID: scriptID,
        };
        await Promise.all([
            db.hsetAsync(tables.startInfo, instanceID, JSON.stringify(startInfo)),
            (async () => {
                await db.saddAsync(tables.unstarted, instanceID);
                await ServerScriptManager.run(instanceID, startInfo);
            })(),
        ]);
    }

    static async save(scriptID, code) {
        await db.hsetAsync(tables.server, scriptID, code);
    }
}
module.exports = ServerScriptManager;