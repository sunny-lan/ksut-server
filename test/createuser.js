const { db } = require('../db');
const mgr = require('../db/user');
(async () => {
    await db.flushdbAsync();
    const user = await mgr.add('sunny', 'aa');
    console.log(await mgr.login('sunny', 'aa'));
    await user.del();
    process.exit(0);
})().catch(e => { console.error(e); process.exit(-1); });