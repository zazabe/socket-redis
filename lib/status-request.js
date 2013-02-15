var util = require('util');
var EventEmitter = require('events').EventEmitter;
var _ = require('underscore');
module.exports = (function() {

	/**
	 * @type {Integer}
	 */
	StatusRequest.prototype.id;

	/**
	 * @type {Object}
	 */
	StatusRequest.prototype.channelsData;

	/**
	 * @type {Integer}
	 */
	StatusRequest.prototype.responsesPending;

	/**
	 * @param {Integer} requestId
	 * @param {Integer} responsesTotal
	 * @constructor
	 */
	function StatusRequest(requestId, responsesTotal) {
		this.id = requestId;
		this.responsesPending = responsesTotal;
		this.channelsData = {};
	}

	util.inherits(StatusRequest, EventEmitter);

	/**
	 * @return {Integer}
	 */
	StatusRequest.prototype.getId = function() {
		return this.id;
	};

	/**
	 * @param {Object} channels
	 */
	StatusRequest.prototype.addResponse = function(channels) {
		_.each(channels, function(clients, channelId) {
			if (!this.channelsData[channelId]) {
				this.channelsData[channelId] = [];
			}
			[].push.apply(this.channelsData[channelId], clients);
		}, this);
		this.responsesPending--;
		if (!this.responsesPending) {
			this.emit('complete');
		}
	};

	/**
	 * @return {Object}
	 */
	StatusRequest.prototype.getChannelsData = function() {
		return this.channelsData;
	};

	return StatusRequest;
})();
