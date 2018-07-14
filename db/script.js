const {transform} = require('@babel/standalone');
const uuid = require('uuid/v4');

const tables = {
    code: 'script-code',
    compiled: 'script-compiled'
};

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
        newCode = newCode.replace('export default', 'return');
        newCode = `(dependencies, id)=>{${newCode};}`;

        //translate jsx
        const compiled = transform(newCode, {
            plugins: ['transform-react-jsx']
        }).code;

        //save translated
        tasks.push(this.commands.redis.hset(tables.compiled, scriptID, compiled));

        await Promise.all(tasks);
        return scriptID;//TODO this shouldn't need to be returned
    }

    async del(scriptID) {
        await Promise.all([
            this.commands.hdel(tables.code, scriptID),
            this.commands.hdel(tables.compiled, scriptID),
        ]);
    }
}
module.exports = ScriptManager;