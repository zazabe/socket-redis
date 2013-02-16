var redis = require('redis'), http = require('http'), _ = require('underscore'), StatusRequest = require('./status-request.js');

module.exports = (function() {

	/**
	 * @type {ChildProcess[]}
	 */
	var workers = [];

	/**
	 * @type {StatusRequest[]}
	 */
	var statusRequests = {};


	/**
	 * @type {RedisClient}
	 */
	var redisClientUp;

	/**
	 * @type {Integer}
	 */
	var statusRequestId = 0;

	/**
	 * @param {String} redisHost
	 * @param {Integer} statusPort
	 * @constructor
	 */
	function Server(redisHost, statusPort) {
		connectRedisDown(redisHost);
		connectRedisUp(redisHost);
		createStatusServer(statusPort);
	}

	/**
	 * @param {ChildProcess} worker
	 */
	Server.prototype.addWorker = function(worker) {
		workers.push(worker);
	};

	Server.prototype.killWorkers = function() {
		workers.forEach(function(worker) {
			worker.kill();
		});
	};

	/**
	 * @param {String} type
	 * @param {Object} data
	 */
	Server.prototype.triggerEventUp = function(type, data) {
		switch (type) {
			case 'up-message':
				sendUpMessage(data.clientKey, data.data);
				break;
			case 'up-subscribe':
				sendUpSubscribe(data.channel, data.clientKey, data.data);
				break;
			case 'up-unsubscribe':
				sendUpUnsubscribe(data.channel, data.clientKey);
				break;
			case 'up-status-request':
				var request = _.find(statusRequests, function(request) {
					return request.getId() === data.requestId;
				});
				if (!request) {
					break;
				}
				request.addResponse(data.channels);
				break;
			default:
				console.log("Invalid up event type: `" + type + "`");
				break;
		}
	};

	/**
	 * @param {String} redisHost
	 */
	var connectRedisDown = function(redisHost) {
		var redisClientDown = redis.createClient(6379, redisHost);

		redisClientDown.on("connect", function() {
			redisClientDown.subscribe('socket-redis-down');
		});

		redisClientDown.on("error", function(msg) {
			console.log("Cannot connect to redis server `" + redisHost + "`: " + msg);
		});

		redisClientDown.on("message", function(channel, event) {
			try {
				event = JSON.parse(event);
				switch (event.type) {
					case 'message':
						sendDownMessage(event.data.channel, event.data.data);
						break;
					default:
						console.log("Invalid down event type: `" + event.type + "`");
						break;
				}
			} catch (e) {
				console.log("Cannot parse message `" + event + "`: " + e);
			}
		});
	};


	/**
	 * @param {String} redisHost
	 */
	var connectRedisUp = function(redisHost) {
		redisClientUp = redis.createClient(6379, redisHost);

		redisClientUp.on("error", function(msg) {
			console.log("Cannot connect to redis server `" + redisHost + "`: " + msg);
		});
	};

	/**
	 * @param {Integer} statusPort
	 */
	var createStatusServer = function(statusPort) {
		var server = http.createServer(function(request, response) {
			statusRequestId++;
			var statusRequest = new StatusRequest(statusRequestId, workers.length);
			statusRequests[statusRequestId] = statusRequest;
			statusRequest.on('complete', function() {
				response.end(JSON.stringify(statusRequest.getChannelsData()));
			});
			request.on('close', function() {
				delete statusRequests[statusRequest.getId()];
			});
			sendDownStatusRequest(statusRequest);
		});
		server.on('connection', function(socket) {
			socket.setTimeout(10000);
		});
		server.listen(statusPort);
	};

	var sendUp = function(type, data) {
		redisClientUp.publish('socket-redis-up', JSON.stringify({type: type, data: data}));
	};

	/**
	 * @param {String} clientKey
	 * @param {Object} data
	 */
	var sendUpMessage = function(clientKey, data) {
		sendUp('message', {clientKey: clientKey, data: data});
	};

	/**
	 * @param {String} channel
	 * @param {String} clientKey
	 * @param {Object} data
	 */
	var sendUpSubscribe = function(channel, clientKey, data) {
		sendUp('subscribe', {channel: channel, clientKey: clientKey, data: data});
	};

	/**
	 * @param {String} channel
	 * @param {String} clientKey
	 */
	var sendUpUnsubscribe = function(channel, clientKey) {
		sendUp('unsubscribe', {channel: channel, clientKey: clientKey});
	};

	/**
	 * @param {String} channel
	 * @param {Object} data
	 */
	var sendDownMessage = function(channel, data) {
		workers.forEach(function(worker) {
			worker.send({type: 'down-message', data: {channel: channel, data: data}});
		});
	};

	/**
	 * @param {StatusRequest} request
	 */
	var sendDownStatusRequest = function(request) {
		workers.forEach(function(worker) {
			worker.send({type: 'down-status-request', data: {requestId: request.getId()}});
		});
	};

	return Server;
})();
