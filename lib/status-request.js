var util = require('util');
var EventEmitter = require('events').EventEmitter;
var _ = require('underscore');

module.exports = (function() {

  /**
   * @type {Number}
   */
  StatusRequest.prototype.id;

  /**
   * @type {Object}
   */
  StatusRequest.prototype.channelsData;

  /**
   * @type {Number}
   */
  StatusRequest.prototype.responsesPending;

  /**
   * @param {Number} requestId
   * @param {Number} responsesTotal
   * @constructor
   */
  function StatusRequest(requestId, responsesTotal) {
    this.id = requestId;
    this.responsesPending = responsesTotal;
    this.channelsData = {};
  }

  util.inherits(StatusRequest, EventEmitter);

  /**
   * @return {Number}
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
        this.channelsData[channelId] = {subscribers: {}};
      }
      _.each(clients, function(client) {
        this.channelsData[channelId].subscribers[client.clientKey] = client;
      }, this);
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
