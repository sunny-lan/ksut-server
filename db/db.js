const bluebird = require('bluebird');
const redis = require('redis');
const {isHeroku} = require('../config/dev');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
const exitHook = require('exit-hook');

const clients = [];

//TODO make create async
function create() {
    let client;
    if (isHeroku())
        client = redis.createClient(process.env.REDIS_URL);
    else
        client = redis.createClient(require('./redis-config'));
    clients.push(client);
    const _quit = client.quit.bind(client);
    client.quit = () => {
        clients.splice(clients.indexOf(client), 1);
        _quit();
        console.log('quit pid:', process.pid, 'count:', clients.length);
    };
    console.log('create pid:', process.pid, 'count:', clients.length);
    return client;
}

const db = create();

module.exports = {
    create,
    db,
};

exitHook(()=>{
    //TODO doesn't fully quit
    console.log(clients.length);
        clients.forEach(client => client.quit());
});