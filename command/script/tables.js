const {namespace} = require('../namespace');

module.exports={
    code: 'script-code',

    info: 'script-info',
    client: 'script-client',
    server: 'script-server',

    instances: 'instance-script',

    startInfo: 'instance-start',
    unstarted: 'instance-unstarted',

    index: word => namespace('index', word),
};