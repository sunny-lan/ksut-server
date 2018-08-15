const serializeError = require('serialize-error');

module.exports = (client, send) => {
    return async message => {
        if (message.type === 'command') {
            //run command and send back response
            let response = {
                type: 'commandResponse',
                id: message.id,
            };
            try {
                response.result = await client.send(message);
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