#!/usr/bin/env node
var socketRedis = require('../socket-redis.js'),
	fs = require('fs'),
	path = require('path'),
	argv = require('optimist').default('redis-hosts', 'localhost').default('socket-port', '8090').default('log-dir', null).default('sockjs-url', null).argv;

var redisHosts = argv['redis-hosts'].split(','),
	socketPort = argv['socket-port'],
	sockjsUrl = argv['sockjs-url'],
	logDir = argv['log-dir'];

fs.mkdirRecursive = function(directory) {
	var pathParts = path.normalize(directory).replace(/\/$/, '').split(path.sep);
	for (var i = 0; i < pathParts.length; i++) {
		var parentDirectory = pathParts.slice(0, i + 1).join(path.sep) + '/';
		fs.mkdir(parentDirectory);
	}
};

if (logDir) {
	fs.mkdirRecursive(logDir);
	var log = fs.createWriteStream(logDir + '/general.log', {'flags': 'a+', 'encoding': 'utf8', 'mode': 0644});
	process.__defineGetter__('stdout', function() { return log; });
	process.__defineGetter__('stderr', function() { return log; });
	process.on('uncaughtException', function(e) { process.stderr.write('Uncaught exception: ' + e + '\n'); });
}

var publisher = new socketRedis.Server(redisHosts);
var worker = new socketRedis.Worker(socketPort, sockjsUrl);
publisher.onMessage = function(channel, message) {
	worker.publish(channel, message);
};
