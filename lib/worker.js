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
	 * @param {String} [sockjsClientUrl]
	 * @param {Object}  [sslOptions]
	 * @constructor
	 */
	function Worker(port, sockjsClientUrl, sslOptions) {
		var allowedLogs = ['error'];
		var sockjsOptions = {};

		sockjsOptions.log = function(severity, message) {
			if (allowedLogs.indexOf(severity) > -1) {
				console.log(severity + "\t" + message);
			}
		};
		if (sockjsClientUrl) {
			sockjsOptions.sockjs_url = sockjsClientUrl;
		}

		sockjsServer = sockjs.createServer(sockjsOptions);
		listen(port, sslOptions);
	}

	/**
	 * @param {String} type
	 * @param {Object} data
	 */
	Worker.prototype.triggerEventDown = function(type, data) {
		switch (type) {
			case 'down-publish':
				sendDownPublish(data.channel, data.event, data.data);
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
	 * @param {String} event
	 * @param {Object} data
	 */
	var sendDownPublish = function(channelId, event, data) {
		if (!channelId || !event || !data) {
			return;
		}
		var channel = channels[channelId];
		if (!channel) {
			return;
		}
		var content = {channel: channelId, event: event, data: data};
		channel.msgs.push({timestamp: new Date().getTime(), content: content});
		if (channel.msgs.length > 10) {
			channel.msgs.splice(0, channel.msgs.length - 10)
		}
		_.each(channel.subscribers, function(subscriber) {
			subscriber.connection.write(JSON.stringify(content));
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
	 * @param {Object} systemData
	 */
	var fixClientData = function(systemData) {
		var clientData = systemData.data;
		if (typeof(clientData.channel) == 'undefined') {
			clientData.channel = new String('null:null');
		}
		if (typeof(clientData.event) == 'undefined') {
			clientData.event = new String();
		}
		if (typeof(clientData.data) == 'undefined') {
			clientData.data = new String();
		}
	};

	/**
	 * @param {Number} port
	 * @param {Object}  [sslOptions]
	 */
	var listen = function(port, sslOptions) {
		var self = this;
		sockjsServer.on('connection', function(connection) {
			var connectionChannelIds = [];
			var unsubscribe = function(channelId) {
				connectionChannelIds = _.without(connectionChannelIds, channelId);
				var channel = channels[channelId];
				if (!channel) {
					return;
				}
				sendUpUnsubscribe(channelId, connection.id);
				channel.subscribers = _.reject(channel.subscribers, function(subscriber) {
					return subscriber.connection === connection;
				});
				if (channel.subscribers.length == 0) {
					channel.closeTimeout = setTimeout(function() {
						delete channels[channelId];
					}, 10000);
				}
			};
			connection.on('data', function(data) {
				data = JSON.parse(data);
				fixClientData(data);
				var eventName = data.event;
				var eventData = data.data;
				switch (eventName) {
					case 'subscribe':
						if (_.contains(connectionChannelIds, eventData.channel)) {
							return;
						}
						var msgStartTime = eventData.start || new Date().getTime();
						var channelId = eventData.channel;
						connectionChannelIds.push(channelId);
						if (!channels[channelId]) {
							channels[channelId] = {subscribers: [], msgs: [], closeTimeout: null};
						}
						var channel = channels[channelId];
						clearTimeout(channel.closeTimeout);
						channel.subscribers.push({connection: connection, data: eventData.data, subscribeStamp: new Date().getTime()});
						_.each(channel.msgs, function(msg) {
							if (msg.timestamp > msgStartTime) {
								connection.write(JSON.stringify(msg.content));
							}
						});
						sendUpSubscribe(channelId, connection.id, eventData.data);
						break;

					case 'unsubscribe':
						unsubscribe(eventData.channel);
						break;

					case 'message':
						sendUpMessage(connection.id, eventData.data);
						break;

					case 'publish':
						eventData.event = 'client-' + eventData.event;
						process.send({type: 'publish', data: {channel: eventData.channel, event: eventData.event, data: eventData.data}});
						break;
				}
			});
			connection.on('close', function() {
				_.each(connectionChannelIds, function(channelId) {
					unsubscribe(channelId);
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
