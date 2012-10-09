var http = require('http'),
	redis = require('redis'),
	sockjs = require('sockjs');

module.exports = (function () {

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
	 * @param {String} sockjsUrl
	 * @constructor
	 */
	function Worker(port, sockjsUrl) {

		var allowedLogs = ['error'];
		var sockjsOptions = {};

		sockjsOptions.log = function (severity, message) {
			if (allowedLogs.indexOf(severity) > -1) {
				console.log(severity + "\t" + message);
			}
		};
		if (sockjsUrl) {
			sockjsOptions.sockjs_url = sockjsUrl;
		}
		sockjsServer = sockjs.createServer(sockjsOptions);
		listen(port);
	}

	/**
	 * @param {String} channelId
	 * @param {Object} message
	 */
	Worker.prototype.publish = function(channelId, message) {
		if (!channelId || !message) {
			return;
		}
		var channel = channels[channelId]
		if (!channel) {
			return;
		}
		channel.msgs.push([new Date().getTime(), message]);
		if (channel.msgs.length > 10) {
			channel.msgs.splice(0, channel.msgs.length - 10)
		}
		for (var index in channel.sockets) {
			channel.sockets[index].write(JSON.stringify(message));
		}
	};

	/**
	 * @param {Integer} port
	 */
	var listen = function(port) {
		var self = this;
		sockjsServer.on('connection', function(connection) {
			var channelId;
			connection.on('data', function(message) {
				message = JSON.parse(message);
				if (message.event === 'subscribe') {
					var data = message.data;
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
