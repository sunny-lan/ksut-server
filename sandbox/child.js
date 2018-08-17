const {VM} = require('vm2');
const makeMessageClient = require('../client/messageClient');
const wrapClient = require('../client/advancedClient');
const {extract} = require('../util');
const EventEmitter = require('events');
const exitHook=require('async-exit-hook');

process.once('message', args => {
    const emitter = new EventEmitter();
    new VM({
        sandbox: {
            ksut: {
                ...extract(emitter),
                ...args.scriptParams,
            },
        }
    }).run(args.code);

    let client;
    if (args.createOwnClient) {
        client = require('../client')(args.runAs);
        exitHook(client.quit);
    } else {
        client = makeMessageClient(process.send.bind(process));
        process.on('message', client.receive);
    }
    emitter.emit('start', wrapClient(client));
});

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason.stack);
    // application specific logging, throwing an error, or other logic here
});