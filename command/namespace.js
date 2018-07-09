function namespace(space, name) {
    return `${space}:${name}`;
}
function getName(namespaced) {
    return namespaced.substring(namespaced.indexOf(':') + 1);
}
function getNamespace(namespaced) {
    return namespaced.substring(0, namespaced.indexOf(':'));
}

module.exports = {
    namespace, getName, getNamespace
};