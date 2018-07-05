const bluebird = require('bluebird');
const redis = require('redis');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

module.exports = {
    create() {
        return redis.createClient(process.env.REDIS_URL);
    },
    db: this.create(),
};