#!/usr/bin/env node
var socketRedis = require('../socket-redis.js'),
	childProcess = require('child_process'),
	utils = require('../lib/utils.js'),
	optimist = require('optimist').default('log-dir', null).default('sockjs-url', null),
	argv = optimist.argv,
	logDir = argv['log-dir'];

if (logDir) {
	utils.logProcessInto(process, logDir + '/general.log');
}

if (!argv.slave) {
	argv = optimist.default('redis-hosts', 'localhost').default('socket-ports', '8090').argv;
	var redisHosts = argv['redis-hosts'].split(','),
		socketPorts = argv['socket-ports'].split(','),
		publisher = new socketRedis.Server(redisHosts);

	socketPorts.forEach(function (socketPort) {
		var args = ['--slave', '--socket-port=' + socketPort];
		if (logDir) {
			args.push('--log-dir=' + logDir);
		}
		var startWorker = function () {
			var worker = childProcess.fork(__filename, args);
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

} else {
	var socketPort = argv['socket-port'],
		worker = new socketRedis.Worker(socketPort);
	process.on('message', function (message) {
		worker.publish(message.channel, message.data);
	});
}