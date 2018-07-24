const {transform} = require('@babel/standalone');
const {db} = require('../../db');
const tables = require('./tables');

class ClientScriptManager {
    static async compile(scriptID, code) {
        code = code.replace('export default', 'return');
        code = `(dependencies)=>{${code};}`;

        //translate jsx
        const compiled = transform(code, {
            plugins: ['transform-react-jsx']
        }).code;

        await db.hsetAsync(tables.client, scriptID, compiled);
    }

    static async fetch(scriptID) {
        return db.hgetAsync(tables.client, scriptID);
    }
}

module.exports = ClientScriptManager;