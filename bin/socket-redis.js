#!/usr/bin/env node
var socketRedis = require('../socket-redis.js'),
	fs = require('fs'),
	path = require('path'),
	cluster = require('cluster'),
	argv = require('optimist').default('redis-hosts', 'localhost').default('socket-port', '8090').default('log-dir', '/var/log/socket-redis/').argv,
	numCPUs = require('os').cpus().length;

var redisHosts = argv['redis-hosts'].split(','),
	socketPort = argv['socket-port'],
	logDir = argv['log-dir'];

fs.mkdirRecursive = function (directory) {
	var pathParts = path.normalize(directory).replace(/\/$/, '').split(path.sep);
	for (var i = 0; i < pathParts.length; i++) {
		var parentDirectory = pathParts.slice(0, i + 1).join(path.sep) + '/';
		fs.mkdir(parentDirectory);
	}
};

fs.mkdirRecursive(logDir);

var log = fs.createWriteStream(logDir + '/general.log', {'flags':'a+', 'encoding':'utf8', 'mode':0644});
process.__defineGetter__('stdout', function() { return log; });
process.__defineGetter__('stderr', function() { return log; });
process.on('uncaughtException', function (e) { process.stderr.write('Uncaught exception: ' + e + '\n'); });

if (cluster.isMaster) {
	var publisher = new socketRedis.Server(redisHosts);
	for (var cpu = 0; cpu < numCPUs; cpu++) {
		cluster.fork();
	}
	publisher.onMessage = function (channel, message) {
		for (var i in cluster.workers) {
			var worker = cluster.workers[i];
			worker.send({channel: channel, message: message});
		}
	};
} else {
	var worker = new socketRedis.Worker(socketPort);
	process.on('message', function (data) {
		worker.publish(data.channel, data.message);
	});
}
