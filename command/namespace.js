function namespace(space, name) {
    return `${space}:${name}`;
}
function getName(namespaced) {
    return namespaced.substring(namespaced.indexOf(':') + 1);
}
function getNamespace(namespaced) {
    const idx = namespaced.indexOf(':');
    if (idx === -1)return;
    return namespaced.substring(0, idx);
}

module.exports = {
    namespace, getName, getNamespace
};