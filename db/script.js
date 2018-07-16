const {transform} = require('@babel/standalone');
const uuid = require('uuid/v4');
const exitHook = require('exit-hook');
const {db} = require('./db');

const tables = {
    code: 'script-code',

    client: 'script-client',
    server: 'script-server',

    instances: 'instance-script',
    running: 'instance-running'
};

const serverRegex = /\/\/ksut: server code begin([\s\S]*)\/\/ksut: server code end/;
const clientRegex = /\/\/ksut: client code begin([\s\S]*)\/\/ksut: client code end/;

class ScriptManager {
    constructor(commands) {
        this.commands = commands;
    }

    //NOTE: scriptID should be generated on first time by client
    async compile(scriptID, newCode) {
        //if there is new code, overwrite, otherwise retrieve from db
        let tasks = [];
        if (!newCode)
            newCode = await this.commands.redis.hget(tables.code, scriptID);
        else
            tasks.push(this.commands.redis.hset(tables.code, scriptID, newCode));

        const serverCode = newCode.match(serverRegex),
            clientCode = newCode.match(clientRegex);

        if(!serverCode && !clientCode)
            throw new Error('No code sent. Code must be flagged with "//ksut: ..."');

        if (clientCode)
            tasks.push(ScriptManager._compileClient(scriptID, clientCode[1]));

        if (serverCode)
            tasks.push(ScriptManager._compileServer(scriptID, serverCode[1]));

        await Promise.all(tasks);
    }

    async instantiate(scriptID) {
        const instanceID = uuid();
        await this.commands.redis.hsetAsync(tables.instances, instanceID, scriptID);
        //TODO run server side code
        return instanceID;
    }

    static async fetch(scriptID) {
        return db.hgetAsync(tables.client, scriptID);
    }

    static async _compileClient(scriptID, code) {
        code = code.replace('export default', 'return');
        code = `(dependencies)=>{${code};}`;

        //translate jsx
        const compiled = transform(code, {
            plugins: ['transform-react-jsx']
        }).code;

        await db.hsetAsync(tables.client, scriptID, compiled);
    }

    static async _compileServer(scriptID, code) {
        await db.hsetAsync(tables.server, scriptID, code);
    }
}
module.exports = ScriptManager;