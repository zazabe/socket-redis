var redis = require('redis');

module.exports = (function() {

	/**
	 * @type {ChildProcess[]}
	 */
	var workers = [];

	/**
	 * @param {String[]} hosts
	 * @constructor
	 */
	function Server(hosts) {
		this.addPublishers(hosts);
	}

	/**
	 * @param {String[]} hosts
	 */
	Server.prototype.addPublishers = function(hosts) {
		hosts.forEach(function(host) {
			addPublisher(host);
		});
	};

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
	 * @param {String} host
	 */
	var addPublisher = function(host) {
		var redisClient = redis.createClient(6379, host);

		redisClient.on("connect", function() {
			redisClient.subscribe('stream');
		});

		redisClient.on("error", function(msg) {
			console.log("Cannot connect to redis server `" + host + "`: " + msg);
		});

		redisClient.on("message", function(channel, message) {
			try {
				message = JSON.parse(message);
				if (!channel || !message) {
					return;
				}
				publish(message.channel, message.data);
			} catch (e) {
				console.log("Cannot parse message `" + message + "`: " + e);
			}
		});
	};

	/**
	 * @param {String} channel
	 * @param {Object} data
	 */
	var publish = function(channel, data) {
		workers.forEach(function(worker) {
			worker.send({channel: channel, data: data});
		});
	};

	return Server;
})();