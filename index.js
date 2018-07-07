const express = require('express');
const expressWs = require('express-ws');
const { defaultPort } = require('./config');
const handleClient = require('./client');
const app = express();
expressWs(app);

app.get('/', function (req, res) {
    res.send('hello world');
});

app.ws('/', function (ws) {
    handleClient(ws);
});

app.listen(process.env.PORT || defaultPort);