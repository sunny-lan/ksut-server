const uuid = require('uuid/v4');
const {db} = require('../../db');
const ClientScriptManager = require('./client');
const ServerScriptManager = require('./server');
const ScriptInfoManager = require('./info');
const tables = require('./tables');
const {namespace} = require('../namespace');

const infoRegex = /\/\/ksut: info begin([\s\S]*)\/\/ksut: info end/;
const serverRegex = /\/\/ksut: server code begin([\s\S]*)\/\/ksut: server code end/;
const clientRegex = /\/\/ksut: client code begin([\s\S]*)\/\/ksut: client code end/;

class ScriptManager {
    constructor(client) {
        this._c = client;
        this._server = new ServerScriptManager(client);
    }

    //NOTE: scriptID should be generated on first time by client
    async compile(scriptID, newCode) {
        //if there is new code, overwrite, otherwise retrieve from db
        let tasks = [];
        if (!newCode)
            newCode = await this._c.s('redis:hget', tables.code, scriptID);
        else
            tasks.push(this._c.s('redis:hset', tables.code, scriptID, newCode));

        let scriptInfo = newCode.match(infoRegex);
        if (!scriptInfo)
            throw new Error(`No script info. Script must contain a //ksut: info section`);
        scriptInfo = JSON.parse(scriptInfo[1]);
        tasks.push(ScriptInfoManager.save(scriptID, scriptInfo));

        const clientCode = newCode.match(clientRegex);
        if (clientCode)
            tasks.push(ClientScriptManager.compile(scriptID, clientCode[1]));

        const serverCode = newCode.match(serverRegex);
        if (serverCode)
            tasks.push(ServerScriptManager.save(scriptID, serverCode[1]));

        await Promise.all(tasks);
    }

    async instantiate(scriptID) {
        const instanceID = uuid();
        await Promise.all([
            this._c.s('redis:hset', tables.instances, instanceID, scriptID),
            this._server.instantiate(instanceID, scriptID),
        ]);
        return instanceID;
    }

    async destroyInstance(instanceID) {
        await Promise.all([
            this._c.s('redis:publish', namespace('kill', instanceID)),
            db.sremAsync(tables.unstarted, instanceID),
            this._c.s('redis:hdel', tables.instances, instanceID),
        ]);
    }

    //client references

    static async fetch(...args) {
        return ClientScriptManager.fetch(...args);
    }

    //info references

    static async fetchInfo(...args) {
        return ScriptInfoManager.fetch(...args);
    }

    static async search(...args) {
        return ScriptInfoManager.search(...args);
    }

    //server references
    static async _init(...args) {
        return ServerScriptManager.init(...args);
    }
}
module.exports = ScriptManager;