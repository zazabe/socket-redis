function WorkerUtil() {
}

/**
 * @param {String} channelId
 * @param {String} event
 * @param {Object} data
 */
WorkerUtil.sendUpPublish = function(channelId, event, data) {
  process.send({type: 'up-publish', data: {channel: channelId, event: event, data: data}});
};

/**
 * @param {String} clientKey
 * @param {Object} data
 */
WorkerUtil.sendUpMessage = function(clientKey, data) {
  process.send({type: 'up-message', data: {clientKey: clientKey, data: data}});
};

/**
 * @param {String} channel
 * @param {String} clientKey
 * @param {Object} data
 */
WorkerUtil.sendUpSubscribe = function(channel, clientKey, data) {
  process.send({type: 'up-subscribe', data: {channel: channel, clientKey: clientKey, data: data}});
};

/**
 * @param {String} channel
 * @param {String} clientKey
 */
WorkerUtil.sendUpUnsubscribe = function(channel, clientKey) {
  process.send({type: 'up-unsubscribe', data: {channel: channel, clientKey: clientKey}});
};

/**
 * @param {Number} requestId
 * @param {Object} channelsData
 */
WorkerUtil.sendUpStatusRequest = function(requestId, channelsData) {
  process.send({type: 'up-status-request', data: {requestId: requestId, channels: channelsData}});
};

module.exports = WorkerUtil;