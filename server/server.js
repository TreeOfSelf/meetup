
//Requires

var Peer = require('simple-peer')
var wrtc = require('wrtc')
var WebSocket = require('ws');
const myRL = require('serverline')
var colors = require('colors');
const https = require('https');
const fs = require('fs');
var Turn = require('node-turn');
var crypto = require('crypto');

function getTURNCredentials(name, secret){    

    var unixTimeStamp = parseInt(Date.now()/1000) + 24*3600,   // this credential would be valid for the next 24 hours
        username = [unixTimeStamp, name].join(':'),
        password,
        hmac = crypto.createHmac('sha1', secret);
    hmac.setEncoding('base64');
    hmac.write(username);
    hmac.end();
    password = hmac.read();
    return {
        username: username,
        password: password
    };
}



var cred  = getTURNCredentials('admin','420420420696969getchagetcha4206969');




//Clear console
process.stdout.write('\x1Bc')

Array.prototype.remove = function() {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};



//Allow input of text to be evaluated into code
myRL.init({
	prompt : '<'.green,
	colorMode : true,
	
})
myRL.setCompletion(['activeClients','message_send','Object.getOwnPropertyNames'])
 
myRL.on('line', function(line) {
	try {
		var result = eval(line);
		if(result!=null){
			console.log(result.toString().bold.brightRed);
		}
	} catch(e){
		//Only display the first line of the error
		console.log((e.toString().split('\n')[0]).red);
	}	
});

var rooms=[];

//List of users
var clients = [];
//List of active users
var activeClients = [];
//Users in lobby waiting for partner
var lobby=[];

//Start the websocket server
/*
	This is the TCP connection we use to start the webRTC UDP connection
*/

const server = https.createServer({
  cert: fs.readFileSync('/etc/letsencrypt/live/shrek.best/fullchain.pem'),
  key: fs.readFileSync('/etc/letsencrypt/live/shrek.best/privkey.pem')
});

const wss = new WebSocket.Server({
  server
});
server.listen(8080);

//Attempts to connect a user in the lobby to another
function lobbyConnect(clientID){
		console.log(('CONNECITNG: '+clientID).yellow);
		console.log(('LOBBY LENGTH: '+lobby.length).brightRed);
	for(var k=0;k<lobby.length;k++){
		var hit=0;
		if(lobby[k]!=clientID){
			var getOne = clientID;
			var getTwo = lobby[k];
			clients[getOne].pconnected=1;
			clients[getTwo].pconnected=1;
			lobby.remove(clientID);
			lobby.remove(lobby[k]);
			console.log((lobby.toString()).brightRed);
			peer_connect(getOne,getTwo);
			hit=1;
		}
	}
	if(hit==0){
		setTimeout(function(clientID){
			console.log( ('TIMER: '+clientID).yellow);
			if(clients[clientID].pconnected==0){
				lobbyConnect(clientID);
			}
		},1500,clientID);
	}
}


//Sets a clients state to disconnected and removes from active client list
function disconnectClient(clientID){
	clients[clientID].connected=0;
	clients[clientID].elevation=0;
	
	if(clients[clientID].room!=null){
		for(var k=0;k<rooms.length;k++){
			if(rooms[k].name == clients[clientID].room){
				var userIndex = rooms[k].users.indexOf(clientID);
				rooms[k].users.splice(userIndex,1);
			}
		}
	}
	
	//Remove from our active clients list if it is present in it
	var clientIndex = activeClients.indexOf(clientID);
	if(clientIndex!=-1){
		activeClients.splice(clientIndex,1);
	}
	clientIndex = lobby.indexOf(clientID);
	if(clientIndex!=-1){
		lobby.splice(clientIndex,1);
	}
	console.log(('Disconnected: '+clientID).brightRed);	
	message_send_udp_all(['lobby_join',activeClients.length]);
}


send_lobby=function(connectID,data){
	if(clients[connectID].room!=null){
		for(var k=0;k<rooms.length;k++){
			if(rooms[k].name==clients[connectID].room){		
				for(var q=0; q<rooms[k].users.length; q++){
					if(rooms[k].users[q]!=connectID){
						message_send(data,rooms[k].users[q]);
					}
				}
			break;
			}
		}
	}
}

//Reacts to certain packet types
function message_receive(data,connectID){
	
	//Check if it is an array, if so set first index to switch input, if not, set the whole value to switch value
	if(Array.isArray(data)==true){
		var switchValue = data[0];
	}else{
		var switchValue = data;
	}

	switch(switchValue){
		default:
			send_lobby(connectID,data);
		break;
		case "room_join":
			if(data[1][0]=='#'){
				data[1]=data[1].substr(1,data[1].length);
			}
			data[1] = data[1].replace(/%20/g, " ");
			var roomID=null;
			for(var k=0;k<rooms.length;k++){
				if(rooms[k].name==data[1]){
					roomID=k;
					//Loop through users and connect
					for(var l=0;l<rooms[k].users.length;l++){
						peer_connect(connectID,rooms[k].users[l]);
					}
					
					break;
				}
			}
			if(roomID!=null){
				rooms[roomID].users.push(connectID);
				clients[connectID].room = data[1];
			}
		break;
		case "get_rooms":
			var sendObj=[];
			for(var k=0;k<rooms.length;k++){
				if(rooms[k].priv!=true){
					sendObj.push( [rooms[k].name,rooms[k].users.length,rooms[k].color] );
				}
			}
			message_send_tcp(['get_rooms',sendObj],connectID);
		break;
		case 'lobby_join':
			if(lobby.indexOf(connectID)==-1){
				lobby.push(connectID);
			}
			clients[0].mode="random";
			clients[0].pconnected=0;
			console.log( ('ADDING: '+connectID).green);
			lobbyConnect(connectID);
		break;
		case "peer_responded":
			message_send_tcp(['peer_final',connectID,data[2]],parseInt(data[1]))
		break;
		case "peer_created":
			message_send_tcp(['peer_respond',connectID,data[2]],parseInt(data[1]));
		break;
		case "connect_signal":
			clients[connectID].UDP.signal(JSON.parse(data[1]));			
		break;
		case "connect_latency_udp":
			message_send_udp('connect_latency_udp',connectID);
		break;
		case "connect_latency_tcp":
			message_send_tcp('connect_latency_tcp',connectID);
		break;
		case "room_create":
			//check if room exists
			var addMod=1;
			var testName = data[1];
			while(true){
				var hit=0;
				for(var k=0;k<rooms.length;k++){
					if(testName==rooms[k].name){
						addMod+=1;
						testName=data[1]+' '+addMod;
						hit=1;
					}
				}
				if(hit==0){
					break;
				}
			}
			var roomID = rooms.length;
			rooms.push({
				id : roomID,
				name : testName,
				priv : data[2],
				color : data[3],
				users : [connectID]
			});
			
			clients[connectID].room = testName;
			message_send_tcp(['room_hash',testName],connectID);
			
		break;
	}
}



function message_send(data,connectID){
	
	if(clients[connectID].connected==1){
		
		switch(clients[connectID].elevation){
			//TCP
			case 1:
				clients[connectID].TCP.send(JSON.stringify(data));
			break;
			//UDP
			case 2:
				clients[connectID].UDP.send(JSON.stringify(data));
			break;
		}
		
	}
}

function message_send_tcp(data,connectID){
	
	if(clients[connectID].connected==1){
		clients[connectID].TCP.send(JSON.stringify(data));			
	}
}

function message_send_udp(data,connectID){
	
	if(clients[connectID].connected==1 && clients[connectID].elevation==2){
		clients[connectID].UDP.send(JSON.stringify(data));			
	}
}

function message_send_udp_all(data,exclude){
	for(var k=0;k<clients.length;k++){
		var connectID = k
		if(clients[connectID].connected==1 && clients[connectID].elevation==2 && exclude!=connectID){
			clients[connectID].UDP.send(JSON.stringify(data));			
		}
	}
}


function peer_connect(clientOne,clientTwo){
	console.log(('trying connection '+clientOne+','+clientTwo).red)
	message_send_tcp(['peer_create',clientTwo],clientOne);
}

//When we get a connection our webSocket connection
wss.on('connection', function connection(ws) {
		
	//Get our connection ID
	var connectID = clients.length;
	clients.push({
		clientID : connectID,
		UDP : 0,
		TCP : ws,
		pconnected : 0,
		elevation : 1,
		connected : 1,
		room : null,
		mode : "",
	});
	
	ws.onclose = function(){
		disconnectClient(connectID);
	}
	
	ws.onerror = function(err){
		disconnectClient(connectID);
		console.log(('error', err.toString().split('\n')[0]).red)
	}
	

	//When we receive a websocket message
	ws.on('message', function incoming(message) {
		//React to message 
		message=JSON.parse(message);
		//console.log(('TCP data from '+connectID+': '+message).magenta);
		message_receive(message,connectID);

	});
	
	console.log(('Connected TCP: '+connectID).brightGreen);
	
	var sendJSON = JSON.stringify(getTURNCredentials(Date.now(),'420420420696969getchagetcha4206969'));
	console.log(sendJSON);
	message_send_tcp(['credentials',sendJSON],connectID);
	
	//Create new peer for webRTC
	clients[connectID].UDP = new Peer({
	  initiator: false,
	  channelConfig: {
		  ordered : false,
		  maxRetransmits :0,
		  
	  },
	  channelName: Math.random().toString(),
	config: { iceServers: [
	{ urls: 'stun:127.0.0.1' },
	{ urls: 'turn:127.0.0.1', username: cred.username, credential: cred.password  }, 		
	] },
	  offerOptions: {},
	  answerOptions: {},
	  sdpTransform: function (sdp) { return sdp },
	  stream: false,
	  streams: [],
	  trickle: true,
	  allowHalfTrickle: false,
	  wrtc: wrtc,
	  objectMode: false
		
	}) 

	clients[connectID].UDP.on('signal', data => {
		var data = JSON.stringify(data);
		data = data.replace("b=AS:30","b=AS:300000");
		message_send(['connect_signal',data],connectID)
	})
	
	clients[connectID].UDP.on('connect', () => {
		console.log(('Connected UPD: '+connectID).brightGreen);
		clients[connectID].elevation=2;
		activeClients.push(connectID);
		message_send('UDP connected',connectID)
		message_send_udp_all(['lobby_join',activeClients.length]);
	})
	
	//Only log the first line of the error 
    clients[connectID].UDP.on('error', err => {
		if(clients[connectID].connected==1){
			disconnectClient(connectID);
			console.log(('error', err.toString().split('\n')[0]).red)
		}
	})

	
	clients[connectID].UDP.on('data', data => {
		data = JSON.parse(data);
		console.log(('UDP data from '+connectID+': '+data).magenta);
		message_receive(data,connectID);
	})
		


});
