var fs = require('fs'),
	path = require('path');

var mkdirRecursive = function(directory) {
	var pathParts = path.normalize(directory).replace(/\/$/, '').split(path.sep);
	for (var i = 0; i < pathParts.length; i++) {
		var parentDirectory = pathParts.slice(0, i + 1).join(path.sep) + '/';
		fs.mkdir(parentDirectory);
	}
};

var logProcessInto = function (process, logFile) {
	mkdirRecursive(path.dirname(logFile));
	var log = fs.createWriteStream(logFile, {'flags': 'a+', 'encoding': 'utf8', 'mode': 0644});
	process.__defineGetter__('stdout', function() { return log; });
	process.__defineGetter__('stderr', function() { return log; });
	process.on('uncaughtException', function(e) { process.stderr.write('Uncaught exception: ' + e + '\n'); });
};

module.exports = {
	logProcessInto: logProcessInto
};