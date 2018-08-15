const {fork} = require('child_process');
const path = require('path');
const {createClient} = require('../client');
const makeMessageHandler = require('../client/messageServer');

const childFile = `${__dirname}/child`;

function run(args) {
    const child = fork(childFile);
    if (!args.createOwnClient) {
        const client = createClient(args.runAs);
        child.on('message', makeMessageHandler(client, child.send.bind(child)));
        child.on('exit', client.quit);
    }
    child.send(args);
    return child;
}

module.exports = run;