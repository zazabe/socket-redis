var redis = require('redis');

module.exports = (function() {

	/**
	 * @type {ChildProcess[]}
	 */
	var workers = [];


	/**
	 * @type {RedisClient}
	 */
	var redisClientUp;

	/**
	 * @param {String} redisHost
	 * @constructor
	 */
	function Server(redisHost) {
		connetRedisDown(redisHost);
		connetRedisUp(redisHost);
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
				sendUpMessage(data.data);
				break;
			case 'up-subscribe':
				sendUpSubscribe(data.channel, data.clientKey, data.data);
				break;
			case 'up-unsubscribe':
				sendUpUnsubscribe(data.channel, data.clientKey);
				break;
			default:
				console.log("Invalid up event type: `" + type + "`");
				break;
		}
	};

	/**
	 * @param {String} redisHost
	 */
	var connetRedisDown = function(redisHost) {
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
	var connetRedisUp = function(redisHost) {
		redisClientUp = redis.createClient(6379, redisHost);

		redisClientUp.on("error", function(msg) {
			console.log("Cannot connect to redis server `" + redisHost + "`: " + msg);
		});
	};

	var sendUp = function(type, data) {
		redisClientUp.publish('socket-redis-up', JSON.stringify({type: type, data: data}));
	};

	/**
	 * @param {Object} data
	 */
	var sendUpMessage = function(data) {
		sendUp('message', {data: data});
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

	return Server;
})();
