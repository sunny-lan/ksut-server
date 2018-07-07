const bluebird = require('bluebird');
const redis = require('redis');
const { isHeroku } = require('../dev');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

function create() {
    if (isHeroku())
        return redis.createClient(process.env.REDIS_URL);
    else
        return redis.createClient(require('./redis-config'));
}

const db = create();

module.exports = {
    create,
    db,
};