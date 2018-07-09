const WebSocket = require('ws');
// const { UserManager } = require('../db/user');
// const { db } = require('../db');

(async () => {
    // await db.flushdbAsync();
    // await UserManager.add('sunny', 'aa');

    const ws = new WebSocket('http://localhost:8080/');
    function s(a) {
        ws.send(JSON.stringify(a));
    }

    ws.on('open', () => {
        console.log('open');
        s({
            type: 'login',
            username: 'admin',
            password: 'pass'
        });
        setTimeout(begin, 500);
    });

    function begin() {
        s({
            type: 'command',
            command: 'redis:subscribe',
            args: ['write:heloo']
        });
        s({
            type: 'command',
            command: 'redis:set',
            args: ['heloo', 'cust']
        });
        s({
            type: 'command',
            command: 'redis:get',
            args: ['heloo'],
        });
        s({
            type: 'command',
            command: 'redis:publish',
            args: ['reet', 'helo'],
        });
        s({
            type:'command',
            command:'goodVibrations',
            args:[],
            id:'hello'
        });
    }

    ws.on('message', console.log);
    ws.on('ping', ()=>console.log('ping'));
    ws.on('disconnect', ()=>console.log('disconnect'));
})().catch(e => { console.error(e); process.exit(-1); });