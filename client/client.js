const {createWrapped, extractClassCommands} = require('../command/wrap');
const ScriptManager = require('../db/script');
const {getName} = require('../command/namespace');
const {create} = require('../db/index');

module.exports = (user, onMessage) => {
    //create redis client for this subscriber
    const sub = create();
    sub.on('message', (channel, message) => onMessage(getName(channel), JSON.parse(message)));

    //create command set
    const commands = {
        redis: createWrapped(sub, user),
        user: extractClassCommands(user),
        script:{}
    };
    Object.assign(commands.script,extractClassCommands(new ScriptManager(commands)), extractClassCommands(ScriptManager));
    commands.good = {
        vibrations(god) {
            if (god)
                throw new Error('tinkle hoy');
            else
                return '1.129848';
        }
    };

    return {commands, quit: sub.quit.bind(sub)};
};