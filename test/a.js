const WebSocket = require('ws');
const ws=new WebSocket('ws://localhost:8080');
ws.on('open', ()=>console.log('open'));
ws.on('message', console.log);