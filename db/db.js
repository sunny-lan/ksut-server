const bluebird = require('bluebird');
const redis = require('redis');
const {isHeroku} = require('../config/dev');
const {together}=require('../util');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
const cleanup = require('../cleanup');
let count = 0;
//TODO make create async
function create() {
    count++;
    console.log('create pid:', process.pid, 'count:', count);

    let client;
    if (isHeroku())
        client = redis.createClient(process.env.REDIS_URL);
    else
        client = redis.createClient(require('./redis-config'));

    const _quit = together(client.quit.bind(client),()=>{
        count--;
        console.log('quit pid:', process.pid, 'count:', count);
    });
    cleanup.add(_quit, 1);
    client.quit = () => {
        cleanup.remove(_quit, 1);
        _quit();
    };

    return client;
}

const db = create();

module.exports = {
    create,
    db,
};