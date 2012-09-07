var http = require('http'),
	url = require('url'),
	socketIo = require('socket.io');

/**
 * @param {Integer} port
 * @constructor
 */
function Worker(port) {
	this.port = port;
	this.channels = {};


	var serverSubscribe = http.createServer();
	serverSubscribe.listen(port);

	this.io = socketIo.listen(serverSubscribe);
	this.io.set('log level', 0);
	this.io.set('transports', ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']);

	this.bindEvents();
}

Worker.prototype.bindEvents = function() {
	this.io.sockets.on('connection', function(socket) {
		var channelId;
		socket.on('subscribe', function(data) {
			if (!channelId && data.channel && data.start) {
				var msgStartTime = data.start;
				channelId = data.channel;
				if (!this.channels[channelId]) {
					this.channels[channelId] = {sockets: [], msgs: [], closeTimeout: null};
				}
				var channel = this.channels[channelId];
				clearTimeout(channel.closeTimeout);
				channel.sockets.push(socket);
				for (var i in channel.msgs) {
					if (channel.msgs[i][0] > msgStartTime) {
						socket.json.send(channel.msgs[i][1]);
					}
				}
			}
		});
		socket.on('disconnect', function() {
			var ch = this.channels[channelId];
			if (!ch) {
				return;
			}
			for (var i in ch.sockets) {
				if (ch.sockets[i] == socket) {
					ch.sockets.splice(i, 1);
				}
			}
			if (ch.sockets.length == 0) {
				ch.closeTimeout = setTimeout(function() {
					delete this.channels[channelId];
				}, 10000);
			}
		});
	});
};

/**
 * @param {Integer} channelId
 * @param {String} message
 */
Worker.prototype.publish = function publish(channelId, message) {
	if (!channelId || !message) {
		return;
	}
	var channel = this.channels[channelId]
	if (!channel) {
		return;
	}
	channel.msgs.push([new Date().getTime(), message]);
	if (channel.msgs.length > 10) {
		channel.msgs.splice(0, channel.msgs.length - 10)
	}
	for (var index in channel.sockets) {
		channel.sockets[index].json.send(message);
	}
};

module.exports = Worker;