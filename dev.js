function isHeroku(){
    return process.env.NODE && ~process.env.NODE.indexOf('heroku');
}

module.exports={
    isHeroku,
};