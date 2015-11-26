var redis = require('redis');
var http = require('http');
var _ = require('underscore');
var StatusRequest = require('./status-request.js');
var validator = require('validator');

module.exports = (function() {

	/**
	 * @type ChildProcess{}
	 */
	var workers = {};

	/**
	 * @type {Object}
	 */
	var statusRequests = {};


	/**
	 * @type {RedisClient}
	 */
	var redisClientUp;

	/**
	 * @type {Number}
	 */
	var statusRequestId = 0;

	/**
	 * @param {String} redisHost
	 * @param {Number} statusPort
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
		workers[worker.pid] = worker;
	};

	/**
	 * @param {ChildProcess} worker
	 */
	Server.prototype.removeWorker = function(worker) {
		delete workers[worker.pid];
	};

	Server.prototype.killWorkers = function() {
		_.each(workers, function(worker) {
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
			case 'publish':
				sendDownPublish(data.channel, data.event, data.data);
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
		var redisClientDown = redis.createClient(6379, redisHost, {retry_max_delay: 60000});

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
					case 'publish':
						if (validator.isNull(event.data.channel) || validator.isNull(event.data.event) || validator.isNull(event.data.data)) {
							throw new Error('Missing data: `' + JSON.stringify(event.data) + '`')
						}

						sendDownPublish(event.data.channel, event.data.event, event.data.data);
						break;
					default:
						console.error("Invalid down event type: `" + event.type + "`");
						break;
				}
			} catch (error) {
				console.error('Error processing Redis data: ' + error);
			}
		});
	};


	/**
	 * @param {String} redisHost
	 */
	var connectRedisUp = function(redisHost) {
		redisClientUp = redis.createClient(6379, redisHost, {retry_max_delay: 60000});

		redisClientUp.on("error", function(msg) {
			console.log("Cannot connect to redis server `" + redisHost + "`: " + msg);
		});
	};

	/**
	 * @param {Number} statusPort
	 */
	var createStatusServer = function(statusPort) {
		var server = http.createServer(function(request, response) {
			statusRequestId++;
			var statusRequest = new StatusRequest(statusRequestId, _.size(workers));
			statusRequests[statusRequestId] = statusRequest;
			statusRequest.on('complete', function() {
				response.end(JSON.stringify(statusRequest.getChannelsData()));
				delete statusRequests[statusRequest.getId()];
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
	 * @param {String} event
	 * @param {Object} data
	 */
	var sendDownPublish = function(channel, event, data) {
		_.each(workers, function(worker) {
			worker.send({type: 'down-publish', data: {channel: channel, event: event, data: data}});
		});
	};

	/**
	 * @param {StatusRequest} request
	 */
	var sendDownStatusRequest = function(request) {
		_.each(workers, function(worker) {
			worker.send({type: 'down-status-request', data: {requestId: request.getId()}});
		});
	};

	return Server;
})();
