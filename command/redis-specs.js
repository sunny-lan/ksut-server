module.exports = {
    pub: {
        publish: (ns, channel, message) => [ns(channel), JSON.stringify(message||'0')],
    },
    sub: {
        subscribe: [
            (ns, channel, ...channels) => [ns(channel), ...channels.map(ns)], //arg mapper
            (gn, channel) => gn(channel), //result mapper
        ],
        unsubscribe: [
            (ns, channel, ...channels) => [ns(channel), ...channels.map(ns)],
            (gn, channel) => gn(channel),
        ],
    },
    read: {
        get: (ns, key) => [ns(key)],
        hkeys: [
            (ns, key) => [ns(key)],
            (gn, keys) => keys.map(gn),
        ],
        hget: (ns, key, field) => [ns(key), field],
        hgetall:(ns,key)=>[ns(key)],
        lrange: (ns, key, start, stop) => [ns(key), start, stop],
    },
    write: {
        set: 0,
        hset: 0,
        hincrby: 0,
        hdel:0,
        lpush: 0,
        ltrim: 0,
    },
};