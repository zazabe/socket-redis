#!/usr/bin/env node
var socketRedis = require('../socket-redis.js'),
	childProcess = require('child_process'),
	fs = require('fs'),
	path = require('path'),
	argv = require('optimist').default('redis-hosts', 'localhost').default('socket-ports', '8090').default('log-dir', null).default('sockjs-url', null).argv;

var redisHosts = String(argv['redis-hosts']).split(','),
	socketPorts = String(argv['socket-ports']).split(','),
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
socketPorts.forEach(function (socketPort) {
	var args = ['--socket-port=' + socketPort];
	if (logDir) {
		args.push('--log-dir=' + logDir);
	}
	var startWorker = function () {
		var worker = childProcess.fork(__dirname + '/worker.js', args);
		publisher.addWorker(worker);
		worker.on('exit', function () {
			startWorker();
		});
	};
	startWorker();
});

process.on('SIGTERM', function () {
	publisher.killWorkers();
	process.exit();
});