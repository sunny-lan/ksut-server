const {fork} = require('child_process');
const path = require('path');
const makeMessageHandler = require('../client/messageServer');
const childFile = `${__dirname}/child`;
const Client = require('../client');

function run(args) {
    const child = fork(childFile);
    let client;
    if (!args.createOwnClient) {
        client = Client.createClient(args.runAs);
        child.on('message', makeMessageHandler(client, child.send.bind(child)));
        child.on('exit', client.quit);
    }
    child.send(args);
    return {
        kill(){
            child.kill('SIGINT');
        },
        client,
    };
}

module.exports.run = run;