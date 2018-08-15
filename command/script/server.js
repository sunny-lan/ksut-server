const {db} = require('../../db');
const tables = require('./tables');
const {VM} = require('vm2');
const clientCreator = require('../../client');
const EventEmitter = require('events');
const UserManager = require('../user');
const exitHook = require('async-exit-hook');
const {namespace} = require("../namespace.js");
const errorHandler=require('../../error');

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
            info.owner = await UserManager.get(info.owner);
        }

        const emitter = new EventEmitter();
        new VM({
            //todo add timeout & detect when script done running
            sandbox: {
                setInterval,
                ksut: {
                    on: emitter.on.bind(emitter),
                },
            }
        }).run(await db.hgetAsync(tables.server, info.scriptID));

        const killMessage = namespace('kill', instanceID),
            restartMessage = namespace('restart', instanceID);
        const client = clientCreator.createClient(info.owner, (message, data) => {
            if (message === killMessage)
                kill().catch(errorHandler);
            else if (message === restartMessage)
                kill()
                    .then(() => ServerScriptManager.run(instanceID, info))
                    .catch(errorHandler);
            else
                emitter.emit('message', message, data);
        });
        client.s('redis:subscribe', killMessage);

        async function kill() {
            emitter.emit('stop');
            client.quit();
            delete running[instanceID];
            await db.saddAsync(tables.unstarted, instanceID);
        }

        await db.sremAsync(tables.unstarted, info.scriptID);
        emitter.emit('start', client.send, client.s);
        running[instanceID] = kill;
    }

    static async init() {
        exitHook(done => {
            Promise.all(Object.keys(running).forEach(instanceID => running[instanceID]()))
                .then(() => console.log('successfully exited'))
                .catch(errorHandler)
                .then(done)
        });
        const unstarted = (await db.smembersAsync(tables.unstarted)) || [];
        await Promise.all(unstarted.map(ServerScriptManager.run));
    }

    async instantiate(instanceID, scriptID) {
        if (!await db.hexistsAsync(tables.server, scriptID))
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