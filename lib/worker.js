var http = require('http'), redis = require('redis'), sockjs = require('sockjs'), _ = require('underscore');

module.exports = (function() {

	/**
	 * @type {Object}
	 */
	var channels = {};

	/**
	 * @type {Object}
	 */
	var sockjsServer;

	/**
	 * @param {Integer} port
	 * @constructor
	 */
	function Worker(port) {

		var allowedLogs = ['error'];
		var sockjsOptions = {};

		sockjsOptions.log = function(severity, message) {
			if (allowedLogs.indexOf(severity) > -1) {
				console.log(severity + "\t" + message);
			}
		};
		sockjsServer = sockjs.createServer(sockjsOptions);
		listen(port);
	}

	/**
	 * @param {String} type
	 * @param {Object} data
	 */
	Worker.prototype.triggerEventDown = function(type, data) {
		switch (type) {
			case 'message-down':
				sendMessageDown(data.channel, data.data);
				break;
			default:
				console.log("Invalid up event type: `" + type + "`");
				break;
		}
	};

	/**
	 * @param {String} channelId
	 * @param {Object} data
	 */
	var sendMessageDown = function(channelId, data) {
		if (!channelId || !data) {
			return;
		}
		var channel = channels[channelId];
		if (!channel) {
			return;
		}
		channel.msgs.push([new Date().getTime(), data]);
		if (channel.msgs.length > 10) {
			channel.msgs.splice(0, channel.msgs.length - 10)
		}
		_.each(channel.sockets, function (socket) {
			socket.write(JSON.stringify(data));
		});
	};

	/**
	 * @param {String} channel
	 * @param {Object} data
	 */
	var sendMessageUp = function(channel, data) {
		process.send({type: 'message-up', data: {channel: channel, data: data}});
	};

	/**
	 * @param {Integer} port
	 */
	var listen = function(port) {
		var self = this;
		sockjsServer.on('connection', function(connection) {
			var channelId;
			connection.on('data', function(data) {
				data = JSON.parse(data);
				switch (data.event) {
					case 'subscribe':
						if (!channelId && data.channel && data.start) {
							var msgStartTime = data.start;
							channelId = data.channel;
							if (!channels[channelId]) {
								channels[channelId] = {sockets: [], msgs: [], closeTimeout: null};
							}
							var channel = channels[channelId];
							clearTimeout(channel.closeTimeout);
							channel.sockets.push(connection);
							for (var i in channel.msgs) {
								if (channel.msgs[i][0] > msgStartTime) {
									connection.write(JSON.stringify(channel.msgs[i][1]));
								}
							}
						}
						break;

					case 'message':
						sendMessageUp(data.channel, data.data);
						break;
				}
			});
			connection.on('close', function() {
				var ch = channels[channelId];
				if (!ch) {
					return;
				}
				for (var i in ch.sockets) {
					if (ch.sockets[i] == connection) {
						ch.sockets.splice(i, 1);
					}
				}
				if (ch.sockets.length == 0) {
					ch.closeTimeout = setTimeout(function() {
						delete channels[channelId];
					}, 10000);
				}
			});
		});

		var server = http.createServer();
		sockjsServer.installHandlers(server, {prefix: '/stream'});
		server.listen(port);
	};

	return Worker;
})();
