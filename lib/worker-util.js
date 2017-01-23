/**
 * @param {Object} process
 * @constructor
 */
function WorkerSender(process) {
  /** @type {Function} */
  this._process = process;
}

WorkerSender.prototype._send = function() {
  this._process.send.apply(this._process, arguments);
};

/**
 * @param {String} channelId
 * @param {String} event
 * @param {Object} data
 */
WorkerSender.prototype.sendUpPublish = function(channelId, event, data) {
  this._send({type: 'up-publish', data: {channel: channelId, event: event, data: data}});
};

/**
 * @param {String} clientKey
 * @param {Object} data
 */
WorkerSender.prototype.sendUpMessage = function(clientKey, data) {
  this._send({type: 'up-message', data: {clientKey: clientKey, data: data}});
};

/**
 * @param {String} channel
 * @param {String} clientKey
 * @param {Object} data
 */
WorkerSender.prototype.sendUpSubscribe = function(channel, clientKey, data) {
  this._send({type: 'up-subscribe', data: {channel: channel, clientKey: clientKey, data: data}});
};

/**
 * @param {String} channel
 * @param {String} clientKey
 */
WorkerSender.prototype.sendUpUnsubscribe = function(channel, clientKey) {
  this._send({type: 'up-unsubscribe', data: {channel: channel, clientKey: clientKey}});
};

/**
 * @param {Number} requestId
 * @param {Object} channelsData
 */
WorkerSender.prototype.sendUpStatusRequest = function(requestId, channelsData) {
  this._send({type: 'up-status-request', data: {requestId: requestId, channels: channelsData}});
};

module.exports = WorkerSender;