//wraps api using command set
//api: each function in set runs a function in api
//middleware: all functions in set run this
function wrap(commandSet, api) {
    return Object.keys(commandSet)//look through original command set
        .filter(command => !command.startsWith('_'))//filter out private commands
        .reduce((wrappedSet, command) => {
            wrappedSet[command] = (...args) => api[command]( commandSet[command](...args));
            return wrappedSet;
        }, {});
}

module.exports = {
    wrap
};