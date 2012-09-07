/**
 * Module dependencies
 */

var http = require('http'), url = require('url'), socketio = require('socket.io'), master = require('child_process'), redis = require('redis');


/**
 * @param {Array} hosts
 * @param {Array} ports
 * @constructor
 */
function Server(hosts, ports) {
	this.ports = ports;
	this.hosts = hosts;
	this.workers = [];

	this.addWorkers(this.ports);
	this.addPublishers(this.hosts);
}

/**
 * @param {Integer} port
 */
Server.prototype.addWorker = function(port) {
	var worker = master.fork(__dirname + '/worker.js', [port], {env: {NODE_PATH: process.env["NODE_PATH"]}});
	this.workers.push(worker);
};

/**
 * @param {Array} ports
 */
Server.prototype.addWorkers = function(ports) {
	var self = this;
	ports.forEach(function(worker) {
		self.addWorker(worker);
	});
};

Server.prototype.addPublishers = function() {
	var self = this;
	this.hosts.forEach(function(host) {
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
			self.publishToWorkers(message.channel, message.data);
		} catch (e) {
			console.log("Cannot parse message `" + message + "`\n");
		}
	});
};

/**
 * @param {Integer} channelId
 * @param {String} message
 */
Server.prototype.publishToWorkers = function(channelId, message) {
	if (!channelId || !message) {
		return;
	}
	this.workers.forEach(function(worker) {
		worker.send({channelId: channelId, message: message});
	});
};

Server.prototype.shutdown = function() {
	this.workers.forEach(function(worker) {
		worker.kill();
	});
};

module.exports = Server;