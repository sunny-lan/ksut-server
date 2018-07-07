const WebSocket = require('ws');
const { UserManager } = require('../db/user');
const { db } = require('../db');
(async () => {
    await db.flushdbAsync();
    await UserManager.add('sunny', 'aa');

    const ws = new WebSocket('http://localhost:8080');
    function s(a) {
        ws.send(JSON.stringify(a));
    }

    function begin(){
        s({
            type:'command',
            command:'subscribe',
            args:['write:heloo']
        });
        s({
            type:'command',
            command:'set',
            args:['heloo','cust']
        });
        s({
            type:'command',
            command:'get',
            args:['heloo']
        });
        s({
            type:'command',
            command:'publish',
            args:['reet', 'helo']
        });
    }

    ws.on('open', () => {
        console.log('open');
        s({
            type: 'login',
            username: 'sunny',
            password: 'aa'
        });
        setTimeout(begin, 500);
    });
    ws.on('message', console.log);
})().catch(e => { console.error(e); process.exit(-1); });