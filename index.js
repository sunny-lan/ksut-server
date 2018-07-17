const express = require('express');
const expressWs = require('express-ws');
const { defaultPort } = require('./config');
const handleClient = require('./websocketClient');
const app = express();
expressWs(app);

app.use(express.static('build'));

app.ws('/', function (ws) {
    handleClient(ws);
});

app.listen(process.env.PORT || defaultPort);