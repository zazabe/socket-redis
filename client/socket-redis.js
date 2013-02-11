var SocketRedis = (function() {

	/**
	 * @type {SockJS}
	 */
	var sockJS;

	/**
	 * @param {String} host
	 * @param {Integer} port
	 * @param {String[]} [protocols]
	 * @constructor
	 */
	function Client(host, port, protocols) {
		var handler = this;
		retryDelayed(0.1, 5, function(retry, resetDelay) {
			// TODO: Removing iframe-htmlfile transport because of https://github.com/sockjs/sockjs-client/issues/90
			protocols = protocols || ['websocket', 'xdr-streaming', 'xhr-streaming', 'iframe-eventsource', 'xdr-polling', 'xhr-polling', 'iframe-xhr-polling', 'jsonp-polling'];
			sockJS = new SockJS('http://' + host + ':' + port + '/stream', null, { protocols_whitelist: protocols });

			sockJS.onopen = function() {
				resetDelay();
				handler.onConnect.call(handler)
			};
			sockJS.onmessage = function(event) {
				handler.onMessage.call(handler, event);
			};
			sockJS.onclose = function() {
				retry();
				handler.onDisconnect.call(handler);
			};
		});
	}

	/**
	 * @param {String} channel
	 * @param {Integer} [start]
	 * @param {Object} [data]
	 */
	Client.prototype.subscribe = function (channel, start, data) {
		sockJS.send(JSON.stringify({event: 'subscribe', channel: channel, start: start, data: data}));
	};

	/**
	 * @param {String} channel
	 */
	Client.prototype.unsubscribe = function (channel) {
		sockJS.send(JSON.stringify({event: 'unsubscribe', channel: channel, start: start, data: data}));
	};

	/**
	 * @param {String} channel
	 * @param {Object} data
	 */
	Client.prototype.message = function (channel, data) {
		sockJS.send(JSON.stringify({event: 'message', channel: channel , data: data}));
	};

	Client.prototype.onConnect = function () {
	};

	Client.prototype.onDisconnect = function () {
	};

	/**
	 * @param {Object} event
	 */
	Client.prototype.onMessage = function(event) {
	};

	/**
	 * @param {Number} delayMin
	 * @param {Number} delayMax
	 * @param {Function} execution fn({Function} retry, {Function} resetDelay)
	 */
	var retryDelayed = function(delayMin, delayMax, execution) {
		delayMin *= 1000;
		delayMax *= 1000;
		var delay = delayMin;
		var timeout;
		var resetDelay = function() {
			delay = delayMin;
			window.clearTimeout(timeout);
		};
		var retry = function() {
			var self = this;
			window.clearTimeout(timeout);
			timeout = window.setTimeout(function() {
				execution.call(self, retry, resetDelay);
				delay = Math.min(Math.max(delayMin, delay * 2), delayMax);
			}, delay);
		};
		execution.call(this, retry, resetDelay);
	};

	return Client;
})();
