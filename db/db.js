const bluebird = require('bluebird');
const redis = require('redis');
const { isHeroku } = require('../config/dev');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
const exitHook=require('exit-hook');

const clients=[];

function create() {
    let client;
    if (isHeroku())
        client=redis.createClient(process.env.REDIS_URL);
    else
        client=redis.createClient(require('./redis-config'));
    clients.push(client);
    return client;
}

const db = create();

module.exports = {
    create,
    db,
};

exitHook(()=>clients.forEach(client=>client.quit()));