var Channel = require('./channel');

/**
 * @constructor
 */
function ChannelList() {
  /** @type {Object} */
  this._channels = {};
}

/**
 * @param {String} channelId
 * @returns {Boolean}
 */
ChannelList.prototype.has = function(channelId) {
  return !!this._channels[channelId];
};

/**
 * @param {String} channelId
 * @returns {Channel}
 */
ChannelList.prototype.get = function(channelId) {
  return this._channels[channelId];
};

/**
 * @returns {Object}
 */
ChannelList.prototype.getAll = function() {
  return this._channels;
};

/**
 * @param {String} channelId
 * @returns {Channel} channel
 */
ChannelList.prototype.create = function(channelId) {
  this._channels[channelId] = new Channel(channelId);
  return this._channels[channelId];
};

/**
 * @param {String} channelId
 */
ChannelList.prototype.delayedClose = function(channelId) {
  var channel = this.get(channelId);
  if (channel) {
    if (channel.closeTimeout) {
      clearTimeout(channel.closeTimeout);
    }
    channel.closeTimeout = setTimeout(function() {
      delete this._channels[channelId];
    }.bind(this), 10000);
  }
};

module.exports = ChannelList;
