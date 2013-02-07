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
			case 'down-message':
				sendDownMessage(data.channel, data.data);
				break;
			default:
				console.log("Invalid down event type: `" + type + "`");
				break;
		}
	};

	/**
	 * @param {String} channelId
	 * @param {Object} data
	 */
	var sendDownMessage = function(channelId, data) {
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
		_.each(channel.sockets, function(socket) {
			socket.write(JSON.stringify(data));
		});
	};

	/**
	 * @param {Object} data
	 */
	var sendUpMessage = function(data) {
		process.send({type: 'up-message', data: {data: data}});
	};

	/**
	 * @param {String} channel
	 * @param {String} clientKey
	 * @param {Object} data
	 */
	var sendUpSubscribe = function(channel, clientKey, data) {
		process.send({type: 'up-subscribe', data: {channel: channel, clientKey: clientKey, data: data}});
	};

	/**
	 * @param {String} channel
	 * @param {String} clientKey
	 */
	var sendUpUnsubscribe = function(channel, clientKey) {
		process.send({type: 'up-unsubscribe', data: {channel: channel, clientKey: clientKey}});
	};

	/**
	 * @param {Integer} port
	 */
	var listen = function(port) {
		var self = this;
		sockjsServer.on('connection', function(connection) {
			var connectionChannelIds = [];
			connection.on('data', function(data) {
				data = JSON.parse(data);
				switch (data.event) {
					case 'subscribe':
						if (_.contains(connectionChannelIds, data.channel)) {
							return;
						}
						var msgStartTime = data.start;
						var channelId = data.channel;
						connectionChannelIds.push(channelId);
						if (!channels[channelId]) {
							channels[channelId] = {sockets: [], msgs: [], closeTimeout: null};
						}
						var channel = channels[channelId];
						clearTimeout(channel.closeTimeout);
						channel.sockets.push(connection);
						_.each(channel.msgs, function(msg) {
							if (msg[0] > msgStartTime) {
								connection.write(JSON.stringify(msg[1]));
							}
						});
						sendUpSubscribe(channelId, connection.id, data.data);
						break;

					case 'unsubscribe':
						if (!_.contains(connectionChannelIds, data.channel)) {
							return;
						}
						connectionChannelIds = _.without(connectionChannelIds, data.channel);
						sendUpUnsubscribe(data.channel, connection.id);
						break;

					case 'message':
						sendUpMessage(data.data);
						break;
				}
			});
			connection.on('close', function() {
				_.each(connectionChannelIds, function(channelId) {
					var channel = channels[channelId];
					if (!channel) {
						return;
					}
					channel.sockets = _.without(channel.sockets, connection);
					sendUpUnsubscribe(channelId, connection.id);
					if (channel.sockets.length == 0) {
						channel.closeTimeout = setTimeout(function() {
							delete channels[channelId];
						}, 10000);
					}
				});
			});
		});

		var server = http.createServer();
		sockjsServer.installHandlers(server, {prefix: '/stream'});
		server.listen(port);
	};

	return Worker;
})();
