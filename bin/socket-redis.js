#!/usr/bin/env node
var socketRedis = require('../socket-redis.js'),
	childProcess = require('child_process'),
	optimist = require('optimist').default('log-dir', null),
	argv = optimist.default('redis-host', 'localhost').argv,
	redisHost = argv['redis-host'],
	logDir = argv['log-dir'],
	log4js = require('log4js');

if (logDir) {
	log4js.clearAppenders();
	log4js.loadAppender('file');
	log4js.addAppender(log4js.appenders.file(logDir + '/socket-redis.log'));
	var logger = log4js.getLogger();
	process.stdout.write = function(content) { return logger.debug(content); };
	process.stderr.write = function(content) { return logger.error(content); };
	process.on('uncaughtException', function(e) { process.stderr.write('Uncaught exception: ' + e + '\n' + e.stack + '\n'); });
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
