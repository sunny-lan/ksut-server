const {db}=require('../db');
const user = require('../db/user');
const mgr = user.UserManager;
(async () => {
	await db.flushdbAsync();
	const user = await mgr.add('sunny', 'aa');
	console.log(await mgr.login('sunny', 'aa'));
	await user.del();
	process.exit(0);
})().catch(e=>{console.error(e);process.exit(-1);});