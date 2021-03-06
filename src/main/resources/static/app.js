var webSocket;
var peerConnections = {};
var streams = {};

var mediaRequest = {
	audio:true,
	video:true
};

var constraints ={ mandatory: { OfferToReceiveAudio: true, OfferToReceiveVideo: true } };

function askPermissionsToShare(){
 
	AdapterJS.webRTCReady(function(isUsingPlugin) {
		navigator.getUserMedia(mediaRequest, function(stream) {
        		onStreamArrived('self', stream);
        		startSignalingProtocol();
		}, console.log);
	});
}

function startSignalingProtocol(){
	webSocket.send(JSON.stringify({
		type:'hello'
	}));
}

function createPeerConnection(id){
	var peerConnection = new RTCPeerConnection({
		iceServers : [
			{
				urls : "stun:stun.iptel.org"
			},
			{
				urls : "stun:stun.ekiga.net"
			},
			{
				urls : "stun:stun.fwdnet.net"
			},
			{
				urls : "stun:stun.ideasip.com"
			}
		]
	});

	peerConnection.onicecandidate = function(event) {
		if (event.candidate) {
			webSocket.send(JSON.stringify({
				to: id,
            	type : "iceCandidate",
				content : event.candidate
			}));
		}
	}

	peerConnection.onaddstream = function (e) {
		onStreamArrived(id, e.stream);
	};

	peerConnection.oniceconnectionstatechange = function() {
		if(peerConnection.iceConnectionState == 'disconnected') {
			$('#stream-'+id).remove();
		}
	}
	peerConnections[id] = peerConnection;
}

function onStreamArrived(id, stream){
    var html = '<video class="col-md-4" id="stream-'+id+'" autoplay="autoplay" ' + (id == 'self' ? 'muted' : '')+  '/>';
    var elem = $(html);
    $("#streamContainer").append(elem);
    elem[0].srcObject = stream;
    streams[id] = stream;
}

function createOffer(id, stream){
	var peerConnection = peerConnections[id];
	peerConnection.addStream(stream);
	peerConnection.createOffer(function (sdp) {
		peerConnection.setLocalDescription(sdp, function() {
			webSocket.send(JSON.stringify({
				to: id,
				type : "offer",
				content : sdp
			}));
		}, console.log);
	}, console.log,constraints);
}

function createAnswer(id, stream){
	var peerConnection = peerConnections[id];
	peerConnection.addStream(stream);
	peerConnection.createAnswer(function (sdp) {
		peerConnection.setLocalDescription(sdp, function() {
			webSocket.send(JSON.stringify({
				to: id,
				type : "answer",
				content : sdp
			}));
		}, console.log);
	}, console.log,constraints);
}

function wsurl(s) {
	var l = window.location;
	return ((l.protocol === "https:") ? "wss://" : "ws://") + l.hostname + (((l.port != 80) && (l.port != 443)) ? ":" + l.port : "") + s;
}

$( document ).ready(function() {
	if ("WebSocket" in window){
		webSocket = new WebSocket(wsurl("/ws"));

		webSocket.onopen = function() {
			askPermissionsToShare();
		};

		webSocket.onmessage = function (evt) {
			var received_msg = JSON.parse(evt.data);
			console.log(JSON.stringify(received_msg));
			switch(received_msg.type){
				case 'hello':
					if(streams['self']){
						createPeerConnection(received_msg.from);
						createOffer(received_msg.from,streams['self']);
					}
					break;
				case 'offer':
					createPeerConnection(received_msg.from);
					var rsd = new RTCSessionDescription(received_msg.content);
					peerConnections[received_msg.from].setRemoteDescription(rsd, function(){
    					createAnswer(received_msg.from, streams['self']);
					},console.log);
					break;
				case 'answer':
					var rsd = new RTCSessionDescription(received_msg.content);
					peerConnections[received_msg.from].setRemoteDescription(rsd, function(){

					},console.log);
					break;
				case  'iceCandidate':
					var candidate = new RTCIceCandidate(received_msg.content);
					peerConnections[received_msg.from].addIceCandidate(candidate, function() {

					}, console.log);
				break;
			}
		};

		webSocket.onclose = function() {

		};

		window.onbeforeunload = function(event) {
			webSocket.close();
		};
	}
	else {
	   alert("WebSocket NOT supported by your Browser!");
	}
});
