const {transform} = require('@babel/standalone');
const uuid = require('uuid/v4');
const exitHook = require('exit-hook');
const {db} = require('./db');
const stemmer = require('stemmer');
const metaphone = require('metaphone');
const {namespace} = require('../command/namespace');
const {removeStopwords}=require('stopword');

const tables = {
    code: 'script-code',

    client: 'script-client',
    server: 'script-server',

    instances: 'instance-script',
    running: 'instance-running',

    info: 'script-info',
    index: word => namespace('index', word),
};

const infoRegex = /\/\/ksut: info begin([\s\S]*)\/\/ksut: info end/;
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

        const scriptInfo = newCode.match(infoRegex),
            serverCode = newCode.match(serverRegex),
            clientCode = newCode.match(clientRegex);

        if (!serverCode && !clientCode)
            throw new Error('No code sent. Code must be flagged with "//ksut: ..."');

        if (scriptInfo)
            tasks.push(ScriptManager._saveInfo(scriptID, scriptInfo[1]));

        if (clientCode)
            tasks.push(ScriptManager._compileClient(scriptID, clientCode[1]));

        if (serverCode)
            tasks.push(ScriptManager._compileServer(scriptID, serverCode[1]));

        await Promise.all(tasks);
    }

    static _getWords(info) {
        let words = [];
        if(!info)return words;
        if (info.name) words=words.concat(info.name.split(' '));
        if (info.description) words=words.concat(info.description.split(' '));
        return removeStopwords(words).map(stemmer).map(metaphone);
    }

    static async _removeFromIndex(scriptID){
        //remove old words from index
        const oldInfo = JSON.parse(await db.hgetAsync(tables.info, scriptID));
        return Promise.all(ScriptManager._getWords(oldInfo)
            .map(word => db.sremAsync(tables.index(word), scriptID)));
    }

    static async _saveInfo(scriptID, info) {
        await ScriptManager._removeFromIndex(scriptID);

        //add new words to index
        let tasks = [];
        const newInfo = JSON.parse(info);//check for json error
        ScriptManager._getWords(newInfo)
            .forEach(word => tasks.push(db.saddAsync(tables.index(word), scriptID)));

        //add info to db
        tasks.push(db.hsetAsync(tables.info, scriptID, info));

        await Promise.all(tasks);
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

    async instantiate(scriptID) {
        const instanceID = uuid();
        await this.commands.redis.hset(tables.instances, instanceID, scriptID);
        //TODO run server side code
        return instanceID;
    }

    async destroyInstance(instanceID){
        await this.commands.redis.hdel(tables.instances, instanceID);
        //TODO stop server side code
    }

    static async fetch(scriptID) {
        return db.hgetAsync(tables.client, scriptID);
    }

    //TODO change to ...terms instead
    static async search(terms){
        return db.sinterAsync(removeStopwords(terms).map(stemmer).map(metaphone).map(tables.index));
    }
}
module.exports = ScriptManager;