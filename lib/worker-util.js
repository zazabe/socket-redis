/**
 * @param {Object} process
 * @constructor
 */
function WorkerUtil(process) {
  /** @type {Function} */
  this._process = process;
}

WorkerUtil.prototype._send = function() {
  this._process.send.apply(this._process, arguments);
};

/**
 * @param {String} channelId
 * @param {String} event
 * @param {Object} data
 */
WorkerUtil.prototype.sendUpPublish = function(channelId, event, data) {
  this._send({type: 'up-publish', data: {channel: channelId, event: event, data: data}});
};

/**
 * @param {String} clientKey
 * @param {Object} data
 */
WorkerUtil.prototype.sendUpMessage = function(clientKey, data) {
  this._send({type: 'up-message', data: {clientKey: clientKey, data: data}});
};

/**
 * @param {String} channel
 * @param {String} clientKey
 * @param {Object} data
 */
WorkerUtil.prototype.sendUpSubscribe = function(channel, clientKey, data) {
  this._send({type: 'up-subscribe', data: {channel: channel, clientKey: clientKey, data: data}});
};

/**
 * @param {String} channel
 * @param {String} clientKey
 */
WorkerUtil.prototype.sendUpUnsubscribe = function(channel, clientKey) {
  this._send({type: 'up-unsubscribe', data: {channel: channel, clientKey: clientKey}});
};

/**
 * @param {Number} requestId
 * @param {Object} channelsData
 */
WorkerUtil.prototype.sendUpStatusRequest = function(requestId, channelsData) {
  this._send({type: 'up-status-request', data: {requestId: requestId, channels: channelsData}});
};

module.exports = WorkerUtil;