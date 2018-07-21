const express = require('express');
const expressWs = require('express-ws');
const {defaultPort} = require('./config');
const handleClient = require('./client/websocket');
const bodyParser = require('body-parser');
const UserManager = require('./db/user');
const serializeError = require('serialize-error');

const app = express();

expressWs(app);

app.use(bodyParser.json());

app.post('/createAccount', (req, res) => {
    UserManager.add(req.body.username, req.body.password)
        .then(() => res.sendStatus(200))
        .catch(e=>res.send(serializeError(e)))
});

app.use(express.static('build'));

app.ws('/', function (ws) {
    handleClient(ws);
});
// Always return the main index.html, so react-router render the route in the client
app.get('*', (req, res) => {
    res.sendFile('build/index.html');
});

app.listen(process.env.PORT || defaultPort);