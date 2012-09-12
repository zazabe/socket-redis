var redis = require('redis');

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
	var self = this;
	hosts.forEach(function(host) {
		self.addPublisher(host);
	});
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
			self.onMessage(message.channel, message.data);
		} catch (e) {
			console.log("Cannot parse message `" + message + "`\n");
			console.log(e);
		}
	});
};

/**
 * @param {String} channel
 * @param {Object} message
 */
Server.prototype.onMessage = function (channel, message) {
	throw 'No `onMessage` callback set';
};

module.exports = Server;