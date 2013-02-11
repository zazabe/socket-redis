var SocketRedis = (function() {

	/**
	 * @type {SockJS}
	 */
	var sockJS;

	/**
	 * @type {Object}
	 */
	var onMessageCallbacks = {};

	/**
	 * @param {String} url
	 * @constructor
	 */
	function Client(url) {
		var handler = this;
		retryDelayed(100, 5000, function(retry, resetDelay) {
			sockJS = new SockJS(url);
			sockJS.onopen = function() {
				resetDelay();
				handler.onopen.call(handler)
			};
			sockJS.onmessage = function(event) {
				var data = JSON.parse(event.data);
				if (onMessageCallbacks[data.channel]) {
					onMessageCallbacks[data.channel].call(handler, data.data);
				}
			};
			sockJS.onclose = function() {
				retry();
				handler.onclose.call(handler);
			};
		});

		// https://github.com/sockjs/sockjs-client/issues/18
		if (window.addEventListener) {
			window.addEventListener('keydown', function(event) {
				if (event.keyCode == 27) {
					event.preventDefault();
				}
			})
		}
	}

	/**
	 * @param {String} channel
	 * @param {Integer} [start]
	 * @param {Object} [data]
	 * @param {Function} [onmessage] fn(data)
	 */
	Client.prototype.subscribe = function(channel, start, data, onmessage) {
		sockJS.send(JSON.stringify({event: 'subscribe', channel: channel, start: start, data: data}));
		onMessageCallbacks[channel] = onmessage;
	};

	/**
	 * @param {String} channel
	 */
	Client.prototype.unsubscribe = function(channel) {
		sockJS.send(JSON.stringify({event: 'unsubscribe', channel: channel}));
	};

	/**
	 * @param {Object} data
	 */
	Client.prototype.send = function(data) {
		sockJS.send(JSON.stringify({event: 'message', data: data}));
	};

	Client.prototype.onopen = function() {
	};

	Client.prototype.onclose = function() {
	};

	/**
	 * @param {Number} delayMin
	 * @param {Number} delayMax
	 * @param {Function} execution fn({Function} retry, {Function} resetDelay)
	 */
	var retryDelayed = function(delayMin, delayMax, execution) {
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
