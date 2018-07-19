const express = require('express');
const expressWs = require('express-ws');
const { defaultPort } = require('./config');
const handleClient = require('./client/websocket');
const app = express();

expressWs(app);

app.use(express.static('build'));

// Always return the main index.html, so react-router render the route in the client
app.get('*', (req, res) => {
    res.sendFile('build/index.html');
});

app.ws('/', function (ws) {
    handleClient(ws);
});

app.listen(process.env.PORT || defaultPort);