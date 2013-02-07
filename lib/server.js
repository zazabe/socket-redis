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
			case 'message-up':
				sendMessageUp(data.channel, data.data);
				break;
			default:
				console.log("Invalid up event type: `" + type + "`");
				break;
		}
	};

	/**
	 * @param {String} channel
	 * @param {Object} data
	 */
	var sendMessageUp = function(channel, data) {
		redisClientUp.publish('socket-redis-up', JSON.stringify({channel: channel, data: data}));
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

		redisClientDown.on("message", function(channel, message) {
			try {
				message = JSON.parse(message);
				if (!channel || !message) {
					return;
				}
				sendMessageDown(message.channel, message.data);
			} catch (e) {
				console.log("Cannot parse message `" + message + "`: " + e);
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

	/**
	 * @param {String} channel
	 * @param {Object} data
	 */
	var sendMessageDown = function(channel, data) {
		workers.forEach(function(worker) {
			worker.send({type: 'message-down', data: {channel: channel, data: data}});
		});
	};

	return Server;
})();
