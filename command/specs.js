module.exports = {
    pub: {
        publish: (ns, channel, message) => [ns(channel), message],
    },
    sub: {
        subscribe: [
            (ns, channel, ...channels) => [ns(channel), ...channels.map(ns)], //arg mapper
            (gn, channel) => gn(channel), //result mapper
        ],
        unsubscribe:[
            (ns, channel, ...channels) => [ns(channel), ...channels.map(ns)],
            (gn, channel) => gn(channel),
        ]
    },
    read: {
        get: (ns, key) => [ns(key)],
        hkeys: [
            (ns, key) => [ns(key)],
            (gn, keys) => keys.map(gn),
        ],
        hget: (ns, key, field) => [ns(key), field]
    },
    write: {
        set: 0,
        hset: 0
    },
};