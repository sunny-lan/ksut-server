module.exports = {};
const {getName, namespace} = require('../command/namespace');
const {create} = require('../db');
const {makeNamespaced, makeEndpoint, makeSpeced} = require('../command/wrap');
const spec = require('../command/redis-specs');
const {db} = require('../db/index');
const ScriptManager = require('../command/script');
const EventEmitter = require('events');
const {extract} = require('../util');

const dbEnd = makeEndpoint(db, true);
const makeDbEnd = () => dbEnd;

function createClient(user, result = {}) {
    const emitter = new EventEmitter();
    //create redis client for this subscriber
    const sub = create();
    sub.on('message', (channel, message) => emitter.emit('message', {
        channel: getName(channel),
        message: JSON.parse(message)
    }));

    const subEnd = makeEndpoint(sub, true);
    const makeSubEnd = () => subEnd;

    function ns(name) {
        return namespace(user.id, name);
    }

    function makeInputMapper(mapper) {
        let argMapper = mapper;
        if (Array.isArray(argMapper))
            argMapper = mapper[0];
        return message => {
            message.args = argMapper(ns, ...message.args);
            return message;
        };
    }

    const namespacer = makeSpeced(spec, {
        pub: makeInputMapper,
        sub: makeInputMapper,
        read: makeInputMapper,
        write(keyIdx){
            return message => {
                const key = message.args[keyIdx];
                result.send({
                    command: 'redis:publish',
                    args: [namespace('write', key), message],
                }).catch(error => emitter.emit('error', error));
                message.args[keyIdx] = ns(key);
                return message;
            };
        }
    });

    const redisEnd = makeSpeced(spec, {
        pub: makeDbEnd,
        sub: makeSubEnd,
        read: makeDbEnd,
        write: makeDbEnd,
    });

    function makeOutputMapper(mapper) {
        if (Array.isArray(mapper))
            return message => {
                message.result = mapper[1](getName, message.result);
                return message;
            };
        return message => message;
    }

    const denamespacer = makeSpeced(spec, makeOutputMapper);

    async function redis(message) {
        return denamespacer(await redisEnd(namespacer(message)));
    }

    const send = makeNamespaced({
        script: makeEndpoint(new ScriptManager(result)),
        user: makeEndpoint(user),
        redis,
        good: makeEndpoint({
            vibrations(god) {
                if (god)
                    throw new Error('tinkle hoy');
                else
                    return '1.129848';
            }
        })
    });

    Object.assign(result, extract(emitter));

    result.send = async (message) => {
        return (await send(message)).result;
    };
    result.s = (command, ...args) => {
        return result.send({command, args});
    };
    //TODO make quit async
    result.quit = sub.quit.bind(sub);
    result.user = user;

    return result;
}

module.exports.createClient = createClient;