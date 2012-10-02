var http = require('http'),
	redis = require('redis'),
    sockjs = require('sockjs');

/**
 * @param {Integer} port
 * @constructor
 */
function Worker(port) {
	this.port = port;
	this.channels = {};

    this.sockjs = sockjs.createServer();
    this.listen();
}

Worker.prototype.listen = function() {
	var self = this;
    this.sockjs.on('connection', function(connection) {
		var channelId;
        connection.on('data', function(message) {
            message = JSON.parse(message);
            if (message.event === 'subscribe') {
                var data = message.data;
                if (!channelId && data.channel && data.start) {
                    var msgStartTime = data.start;
                    channelId = data.channel;
                    if (!self.channels[channelId]) {
                        self.channels[channelId] = {sockets: [], msgs: [], closeTimeout: null};
                    }
                    var channel = self.channels[channelId];
                    clearTimeout(channel.closeTimeout);
                    channel.sockets.push(connection);
                    for (var i in channel.msgs) {
                        if (channel.msgs[i][0] > msgStartTime) {
                            // channel.msgs[i][1]
                            connection.write('Something is sent');
                        }
                    }
                }
            }
		});
        connection.on('close', function() {
			var ch = self.channels[channelId];
			if (!ch) {
				return;
			}
			for (var i in ch.sockets) {
				if (ch.sockets[i] == connection) {
					ch.sockets.splice(i, 1);
				}
			}
			if (ch.sockets.length == 0) {
				ch.closeTimeout = setTimeout(function() {
					delete self.channels[channelId];
				}, 10000);
			}
		});
	});

    var server = http.createServer();
    this.sockjs.installHandlers(server, {prefix:'/echo'});
    server.listen(this.port, '127.0.0.1');
};

/**
 * @param {String} channelId
 * @param {String} message
 */
Worker.prototype.publish = function (channelId, message) {
	if (!channelId || !message) {
		return;
	}
	var channel = this.channels[channelId]
	if (!channel) {
		return;
	}
	channel.msgs.push([new Date().getTime(), message]);
	if (channel.msgs.length > 10) {
		channel.msgs.splice(0, channel.msgs.length - 10)
	}
	for (var index in channel.sockets) {
		channel.sockets[index].write(JSON.stringify(message));
	}
};

module.exports = Worker;