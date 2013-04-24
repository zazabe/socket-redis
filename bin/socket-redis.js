#!/usr/bin/env node
var socketRedis = require('../socket-redis.js'),
	childProcess = require('child_process'),
	utils = require('../lib/utils.js'),
	optimist = require('optimist').default('log-dir', null),
	fs = require('fs'),
	_ = require('underscore'),
	argv = optimist.default('redis-host', 'localhost').argv,
	redisHost = argv['redis-host'],
	logDir = argv['log-dir'],
	sslKey = argv['ssl-key'],
	sslCert = argv['ssl-cert'],
	sslPfx = argv['ssl-pfx'],
	sslPassphrase = argv['ssl-passphrase'],
	sslChain = argv['ssl-chain'];


if (logDir) {
	utils.logProcessInto(process, logDir + '/socket-redis.log');
}

if (!process.send) {
	argv = optimist.default('socket-ports', '8090').default('status-port', '8085').argv;
	var socketPorts = String(argv['socket-ports']).split(','),
		publisher = new socketRedis.Server(redisHost, argv['status-port']);

	socketPorts.forEach(function (socketPort) {
		var args = ['--socket-port=' + socketPort];
		if (logDir) {
			args.push('--log-dir=' + logDir);
		}
		if (sslKey) {
			args.push('--ssl-key=' + sslKey);
		}
		if (sslCert) {
			args.push('--ssl-cert=' + sslCert);
		}
		if (sslPfx) {
			args.push('--ssl-pfx=' + sslPfx);
		}
		if (sslPassphrase) {
			args.push('--ssl-passphrase=' + sslPassphrase);
		}
		if (sslChain) {
			args.push('--ssl-chain=' + sslChain);
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
	var sslOptions = null;
	if (sslKey && sslCert) {
		sslOptions = {
			key: fs.readFileSync(sslKey),
			cert: fs.readFileSync(sslCert)
		};
	}
	if (sslPfx) {
		sslOptions = {
			pfx: fs.readFileSync(sslPfx)
		};
	}
	if (sslOptions && sslPassphrase) {
		sslOptions.passphrase = fs.readFileSync(sslPassphrase).toString().trim();
	}
	if (sslOptions && sslChain) {
		// Source: http://www.benjiegillam.com/2012/06/node-dot-js-ssl-certificate-chain/
		sslOptions.ca = [];
		var cert = [];
		_.each(fs.readFileSync(sslChain).toString().split("\n"), function(line) {
			if (line.length > 0) {
				cert.push(line);
				if (line.match(/-END CERTIFICATE-/)) {
					sslOptions.ca.push(cert.join("\n"));
					cert = [];
				}
			}
		});
	}
	var socketPort = argv['socket-port'],
		worker = new socketRedis.Worker(socketPort, sslOptions);
	process.on('message', function (event) {
		worker.triggerEventDown(event.type, event.data);
	});
}
