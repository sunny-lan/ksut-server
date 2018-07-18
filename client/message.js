const {getName, getNamespace} = require('../command/namespace');
const serializeError = require('serialize-error');

module.exports = (client, send) => {
    const commands=client.commands;
    return async message => {
        if (message.type === 'command') {
            //run command and send back response
            let response = {
                type: 'commandResponse',
                id: message.id,
            };
            try {
                let command;
                command = commands[getNamespace(message.command)];
                if (command === undefined)
                    throw new Error('Invalid namespace');
                command = command[getName(message.command)];
                if (command === undefined)
                    throw new Error('Invalid command');
                response.result = await command(...message.args);
                response.subType = 'result';
            } catch (error) {
                response.subType = 'error';
                response.error = serializeError(error);
            }
            send(response);
        } else
            throw new Error('Invalid message type');
    };
};