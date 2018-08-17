const { db } = require('../db');
const mgr = require('../command/user');
(async () => {
    //const user = await mgr.add('tester', 'pass');
    //console.log(await mgr.login('tester', 'pass'));
    //await user.del();
    process.exit(0);
})().catch(e => { console.error(e); process.exit(-1); });