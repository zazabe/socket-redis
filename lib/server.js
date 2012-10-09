var redis = require('redis');

/**
 * @param {String[]} hosts
 * @constructor
 */
function Server(hosts) {
	this.workers = [];
	this.addPublishers(hosts);
}

/**
 * @param {String[]} hosts
 */
Server.prototype.addPublishers = function(hosts) {
	var self = this;
	hosts.forEach(function(host) {
		self.addPublisher(host);
	});
};

/**
 * @param {ChildProcess} worker
 */
Server.prototype.addWorker = function (worker) {
	this.workers.push(worker);
};

/**
 * @param {String} host
 */
Server.prototype.addPublisher = function(host) {
	var self = this, redisClient = redis.createClient(6379, host);

	redisClient.on("connect", function() {
		redisClient.subscribe('stream');
	});

	redisClient.on("message", function(channel, message) {
		try {
			message = JSON.parse(message);
			if (!channel || !message) {
				return;
			}
			self.publish(message.channel, message.data);
		} catch (e) {
			console.log("Cannot parse message `" + message + "`: " + e);
		}
	});
};

Server.prototype.publish = function (channel, data) {
	this.workers.forEach(function (worker) {
		worker.send({channel: channel, data: data});
	});
};

/**
 * @param {String} channel
 * @param {Object} message
 */
Server.prototype.onMessage = function(channel, message) {
	throw 'No `onMessage` callback set';
};
module.exports = Server;