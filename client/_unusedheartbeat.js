//TODO use this someday
const _clientSend = client.send;
let doom;
client.send = message => {
    if (message.command === 'good:vibrations') {
        clearTimeout(doom);
        doom = setTimeout(guardServer(() => {
            throw new Error('Client failed timeout');
        }), config.timeout + config.forgiveness);
    }
};