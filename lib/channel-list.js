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
ChannelList.prototype.hasChannel = function(channelId) {
  return !!this._channels[channelId];
};

/**
 * @param {String} channelId
 * @returns {Channel}
 */
ChannelList.prototype.getChannel = function(channelId) {
  return this._channels[channelId];
};

/**
 * @returns {Object}
 */
ChannelList.prototype.getChannels = function() {
  return this._channels;
};

/**
 * @param {String} channelId
 * @returns {Channel} channel
 */
ChannelList.prototype.createChannel = function(channelId) {
  this._channels[channelId] = new Channel(channelId);
  return this._channels[channelId];
};

/**
 * @param {String} channelId
 */
ChannelList.prototype.delayedCloseChannel = function(channelId) {
  var channel = this.getChannel(channelId);
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
