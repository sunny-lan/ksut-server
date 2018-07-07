module.exports = {
    pub: {
        publish: (ns, channel, message) => [ns(channel), message],
    },
    sub:{
        subscribe: (ns, channel, ...channels) => [ns(channel), ...channels.map(ns)],
    },
    read: {
        get: (ns, key) => [ns(key)],
    },
    write: {
        set: 0
    },
};