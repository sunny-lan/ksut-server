const {db} = require('../../db');
const tables = require('./tables');
const UserManager = require('../user');
const errorHandler = require('../../error');
const {waitTerminate} = require('../../config');
const sandbox = require('../../sandbox');
const {namespace} = require('../namespace');
const {wait} = require('../../util');
const uuid = require('uuid/v4');
const wrapClient = require('../../client/advancedClient');
const cleanup=require('../../cleanup');

class ServerScriptManager {
    constructor(client) {
        this._c = client;
    }

    static async run(instanceID, info) {
        //check if already running
        if (!await db.sismemberAsync(tables.unstarted, instanceID))
            throw new Error('Script is already running');

        //load info from db as needed
        if (!info)
            info = JSON.parse(await db.hgetAsync(tables.startInfo, instanceID));
        if (!info.owner)
            info.owner = await UserManager.get(info.ownerID);

        const code = await db.hgetAsync(tables.server, info.scriptID);

        //mark as running
        await db.sremAsync(tables.unstarted, instanceID);

        //actually run
        const instance = sandbox.run({
            code,
            runAs: info.owner,
            scriptParams: {
                instanceID,
            }
        });

        const instanceClient = wrapClient(instance.client);

        //subscribe to signals
        const sigkill = namespace('kill', instanceID), sigrestart = namespace(instanceID, 'restart');
        instanceClient.s('redis:subscribe', sigkill);
        instanceClient.s('redis:subscribe', sigrestart);
        let killed = false;

        async function kill() {
            if (killed)return;
            killed = true;
            await db.saddAsync(tables.unstarted, instanceID);
            await wait(waitTerminate);
            instance.kill();
        }

        //TODO protect from async errors
        instanceClient.channel.once(sigkill, kill);
        instanceClient.channel.once(sigrestart, async () => {
            await kill();
            await ServerScriptManager.run(instanceID);
        });

        //kill on process termination
        cleanup.add(kill);
    }

    static async init() {
        const unstarted = (await db.smembersAsync(tables.unstarted)) || [];
        await Promise.all(unstarted.map(ServerScriptManager.run));
    }

    async instantiate(scriptID, instanceID) {
        //check if server script exists
        if (!await db.hexistsAsync(tables.server, scriptID))
            return;

        await Promise.all([
            //store start info
            db.hsetAsync(tables.startInfo, instanceID, JSON.stringify({
                ownerID: this._c.user.id,
                scriptID,
            })),
            //add to unstarted list then run
            (async () => {
                await db.saddAsync(tables.unstarted, instanceID);
                await ServerScriptManager.run(instanceID, {
                    owner: this._c.user,
                    scriptID,
                });
            })(),
        ]);
    }

    async destroy(instanceID) {//TODO security risk
        //check if server script exists
        if (!await db.hexistsAsync(tables.startInfo, instanceID))
            return;

        await this._c.s('redis:publish', namespace('kill', instanceID));
        await wait(waitTerminate);
        await db.sremAsync(tables.unstarted, instanceID);
    }

    static async save(scriptID, code) {
        await db.hsetAsync(tables.server, scriptID, code);
    }
}
module.exports = ServerScriptManager;