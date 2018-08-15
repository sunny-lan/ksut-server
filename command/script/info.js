const stemmer = require('stemmer');
const metaphone = require('metaphone');
const {removeStopwords} = require('stopword');
const {db} = require('../../db');
const tables = require('./tables');

class ScriptInfoManager {
    static _getWords(info) {
        let words = [];
        if (!info)return words;
        if (info.name) words = words.concat(info.name.split(' '));
        if (info.description) words = words.concat(info.description.split(' '));
        return removeStopwords(words).map(stemmer).map(metaphone);
    }

    static async remove(scriptID) {
        const info = await db.hgetAsync(tables.info, scriptID);
        if (!info)return;//is not in index
        //remove old words from index
        const oldInfo = JSON.parse(info);
        return Promise.all(ScriptInfoManager._getWords(oldInfo)
            .map(word => db.sremAsync(tables.index(word), scriptID)));
    }

    static async save(scriptID, info) {
        //remove old info
        await ScriptInfoManager.remove(scriptID);

        //add new words to index
        let tasks = [];
        ScriptInfoManager._getWords(info)
            .forEach(word => tasks.push(db.saddAsync(tables.index(word), scriptID)));

        //add info to db
        tasks.push(db.hsetAsync(tables.info, scriptID, JSON.stringify(info)));

        await Promise.all(tasks);
    }

    //TODO change to ...terms instead
    static async search(terms) {
        return db.sinterAsync(removeStopwords(terms).map(stemmer).map(metaphone).map(tables.index));
    }

    static async fetch(scriptID) {
        return JSON.parse(await db.hgetAsync(tables.info, scriptID));
    }
}

module.exports=ScriptInfoManager;