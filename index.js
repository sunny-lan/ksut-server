const WebSocket =require('ws');
const wss=new WebSocket.Server({port:8080});

const handleClient=require('./client');

wss.on('connection', handleClient);