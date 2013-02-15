#!/usr/bin/env node
var socketRedis = require('../socket-redis.js'),
	childProcess = require('child_process'),
	utils = require('../lib/utils.js'),
	optimist = require('optimist').default('log-dir', null),
	argv = optimist.default('redis-host', 'localhost').argv,
	redisHost = argv['redis-host'],
	statusPort = argv['status-port'],
	logDir = argv['log-dir'];

if (logDir) {
	utils.logProcessInto(process, logDir + '/socket-redis.log');
}

if (!process.send) {
	argv = optimist.default('socket-ports', '8090').default('status-port', 8086).argv;
	var socketPorts = argv['socket-ports'].split(','),
		publisher = new socketRedis.Server(redisHost, argv['status-port']);

	socketPorts.forEach(function (socketPort) {
		var args = ['--socket-port=' + socketPort];
		if (logDir) {
			args.push('--log-dir=' + logDir);
		}
		var startWorker = function () {
			var worker = childProcess.fork(__filename, args);
			publisher.addWorker(worker);
			worker.on('exit', function () {
				startWorker();
			});
			worker.on('message', function(event) {
				publisher.triggerEventUp(event.type, event.data);
			});
		};
		startWorker();
	});

	process.on('SIGTERM', function () {
		publisher.killWorkers();
		process.exit();
	});

} else {
	var socketPort = argv['socket-port'],
		worker = new socketRedis.Worker(socketPort, redisHost);
	process.on('message', function (event) {
		worker.triggerEventDown(event.type, event.data);
	});
}
