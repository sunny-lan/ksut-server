const errorHandler = require('./error');

// catching signals and do something before exit
const hooks = [];
['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
    'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
].forEach(sig => process.on(sig, () => {
    console.log('recieved signal: ' + sig);
    hooks.reduce(
        (promise, list) => promise.then(
            () => Promise.all(list.map(func => func()))
        ),
        Promise.resolve()
    ).then(process.exit).catch(error => {
        errorHandler(error);
        process.exit(1);
    });
}));

module.exports = {
    add(callback, priority = 0) {
        hooks[priority] = hooks[priority] || [];
        hooks[priority].push(callback);
    },
    remove(callback, priority = 0){
        hooks[priority].splice(hooks[priority].indexOf(callback), 1);
    },
};