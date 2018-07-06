const bluebird = require('bluebird');
const redis = require('redis');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

function create() {
    if (process.env.NODE && ~process.env.NODE.indexOf('heroku'))
        return redis.createClient(process.env.REDIS_URL);
    else
        return redis.createClient(require('./redis-config'));
}

module.exports = {
    create,
    db: create(),
};