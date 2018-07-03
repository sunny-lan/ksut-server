module.exports.Router=class Router{
    Router(){
        clients={};
    }

    addClient(client){
        clients[client.uuid]=client;
    }

    send( message,source, destination){
        if(destination)
        clients[destination].recieve(source, message);
    }
};