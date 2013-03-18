var redis = require('redis'), sockjs = require('sockjs'), _ = require('underscore');

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
	 * @param {Number} port
	 * @param {Object}  [sslOptions]
	 * @constructor
	 */
	function Worker(port, sslOptions) {
		var allowedLogs = ['error'];
		var sockjsOptions = {};

		sockjsOptions.log = function(severity, message) {
			if (allowedLogs.indexOf(severity) > -1) {
				console.log(severity + "\t" + message);
			}
		};
		sockjsServer = sockjs.createServer(sockjsOptions);
		listen(port, sslOptions);
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
			case 'down-status-request':
				sendUpStatusRequest(data.requestId, getChannelsData());
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
		_.each(channel.subscribers, function(subscriber) {
			subscriber.connection.write(JSON.stringify({channel: channelId, data: data}));
		});
	};

	/**
	 * @param {String} clientKey
	 * @param {Object} data
	 */
	var sendUpMessage = function(clientKey, data) {
		process.send({type: 'up-message', data: {clientKey: clientKey, data: data}});
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
	 * @param {Number} requestId
	 * @param {Object} channels
	 */
	var sendUpStatusRequest = function(requestId, channels) {
		process.send({type: 'up-status-request', data: {requestId: requestId, channels: channels}});
	};

	/**
	 * @return {Object}
	 */
	var getChannelsData = function() {
		var channelsData = {};
		_.each(channels, function(channel, channelId) {
			channelsData[channelId] = _.map(channel.subscribers, function(subscriber) {
				return {clientKey: subscriber.connection.id, data: subscriber.data, subscribeStamp: subscriber.subscribeStamp};
			});
		});
		return channelsData;
	};

	/**
	 * @param {Number} port
	 * @param {Object}  [sslOptions]
	 */
	var listen = function(port, sslOptions) {
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
						var msgStartTime = data.start || new Date().getTime();
						var channelId = data.channel;
						connectionChannelIds.push(channelId);
						if (!channels[channelId]) {
							channels[channelId] = {subscribers: [], msgs: [], closeTimeout: null};
						}
						var channel = channels[channelId];
						clearTimeout(channel.closeTimeout);
						channel.subscribers.push({connection: connection, data: data.data, subscribeStamp: new Date().getTime()});
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
						sendUpMessage(connection.id, data.data);
						break;
				}
			});
			connection.on('close', function() {
				_.each(connectionChannelIds, function(channelId) {
					var channel = channels[channelId];
					if (!channel) {
						return;
					}
					channel.subscribers = _.reject(channel.subscribers, function(subscriber) {
						return subscriber.connection === connection;
					});
					sendUpUnsubscribe(channelId, connection.id);
					if (channel.subscribers.length == 0) {
						channel.closeTimeout = setTimeout(function() {
							delete channels[channelId];
						}, 10000);
					}
				});
			});
		});

		var server;
		if (sslOptions) {
			server = require('https').createServer(sslOptions);
		} else {
			server = require('http').createServer();
		}
		sockjsServer.installHandlers(server);
		server.listen(port);
	};

	return Worker;
})();
