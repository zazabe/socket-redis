var util = require('util');
var EventEmitter = require('events');
var _ = require('underscore');
var validator = require('validator');
var Subscriber = require('./subscriber');
var WorkerUtil = require('./worker-util');

/**
 * @param {SockJSConnection} connection
 * @param {ChannelList} channelList
 * @constructor
 */
function WorkerConnection(connection, channelList) {
  /** @type {String} */
  this.id = connection.id;

  /** @type {SockJSConnection} */
  this._connection = connection;

  /** @type {ChannelList} */
  this._channelList = channelList;

  /** @type {String[]} */
  this._сhannelIds = [];

  /** @type {Number} */
  this._timeout = null;

  this._connection.on('data', this._onData.bind(this));
  this._connection.on('close', this.close.bind(this));

  this._startTimeout();
}

util.inherits(WorkerConnection, EventEmitter);

/**
 * @param {String} channelId
 * @returns {Boolean}
 */
WorkerConnection.prototype.hasChannelId = function(channelId) {
  return _.contains(this._сhannelIds, channelId);
};

/**
 * @param {String} channelId
 */
WorkerConnection.prototype.addChannelId = function(channelId) {
  this._сhannelIds.push(channelId);
};

/**
 * @param {String} channelId
 */
WorkerConnection.prototype.removeChannelId = function(channelId) {
  this._сhannelIds = _.without(this._сhannelIds, channelId);
};

/**
 * @param {String} channelId
 * @param {String} data
 * @param {Number} [msgStartTime]
 */
WorkerConnection.prototype.subscribe = function(channelId, data, msgStartTime) {
  if (this.hasChannelId(channelId)) {
    return;
  }
  msgStartTime = msgStartTime || new Date().getTime();
  this.addChannelId(channelId);
  if (!this._channelList.hasChannel(channelId)) {
    this._channelList.createChannel(channelId);
  }
  var channel = this._channelList.getChannel(channelId);
  clearTimeout(channel.closeTimeout);
  channel.addSubscriber(new Subscriber(this, data));
  _.each(channel.getMessages(), function(message) {
    if (message.createStamp > msgStartTime) {
      this.write(message.content);
    }
  }, this);
  WorkerUtil.sendUpSubscribe(channelId, this.id, data);
};

/**
 * @param {String} channelId
 */
WorkerConnection.prototype.unsubscribe = function(channelId) {
  this.removeChannelId(channelId);
  if (!this._channelList.hasChannel(channelId)) {
    return;
  }
  var channel = this._channelList.getChannel(channelId);
  WorkerUtil.sendUpUnsubscribe(channelId, this.id);

  channel.unsubscribe(this);
  if (!channel.hasSubscribers()) {
    this._channelList.delayedCloseChannel(channelId);
  }
};

WorkerConnection.prototype.write = function(content) {
  this._connection.write(JSON.stringify(content));
};

/**
 * @param {String} channelId
 * @param {String} event
 * @param {Object} data
 */
WorkerConnection.prototype.publish = function(channelId, event, data) {
  event = 'client-' + event;
  WorkerUtil.sendUpPublish(channelId, event, data);
};

/**
 * @param {String} clientKey
 * @param {Object} data
 */
WorkerConnection.prototype.message = function(clientKey, data) {
  WorkerUtil.sendUpMessage(clientKey, data);
};

WorkerConnection.prototype._onData = function(data) {
  try {
    data = JSON.parse(data);

    if (validator.isNull(data.event)) {
      throw new Error('Missing `data.event`: `' + JSON.stringify(data) + '`')
    }
    var eventData = data.data;
    switch (data.event) {
      case 'subscribe':
        if (validator.isNull(eventData.channel) || validator.isNull(eventData.data) || !validator.isInt(eventData.start)) {
          throw new Error('Missing data: `' + JSON.stringify(eventData) + '`')
        }

        this.subscribe(eventData.channel, eventData.data, eventData.start);
        break;

      case 'unsubscribe':
        if (validator.isNull(eventData.channel)) {
          throw new Error('Missing `data.channel`: `' + JSON.stringify(eventData) + '`')
        }

        this.unsubscribe(eventData.channel);
        break;

      case 'message':
        if (validator.isNull(eventData.data)) {
          throw new Error('Missing `data.data`: `' + JSON.stringify(eventData) + '`')
        }

        this.message(this.id, eventData.data);
        break;

      case 'publish':
        if (typeof eventData.data === 'undefined') {
          eventData.data = null;
        }
        if (validator.isNull(eventData.channel) || validator.isNull(eventData.event)) {
          throw new Error('Missing channel or event: `' + JSON.stringify(eventData) + '`')
        }

        this.publish(eventData.channel, eventData.event, eventData.data);
        break;

      case 'heartbeat':
        /**
         * SockJS usually sends heartbeats from the server to the client.
         * If a client directly connects to the low level `/websocket` endpoint it
         * should send heartbeats itself from the client to the server.
         */
        this._startTimeout();
        break;

      default:
        throw new Error('Unexpected event type `' + data.event + '`.');
    }
  } catch (error) {
    console.error('Error processing WebSocket data: ' + error);
  }
};

WorkerConnection.prototype.close = function() {
  if (this._connection) {
    this._connection.removeAllListeners();

    this._stopTimeout();
    _.each(this._сhannelIds, function(channelId) {
      this.unsubscribe(channelId);
    }, this);

    this._connection.close();
    this._connection = null;
    this.emit('close');
  }
};

WorkerConnection.prototype._startTimeout = function() {
  this._stopTimeout();
  this._timeout = setTimeout(function() {
    this.close();
  }.bind(this), 1000 * 1000);
};

WorkerConnection.prototype._stopTimeout = function() {
  if (this._timeout) {
    clearTimeout(this._timeout);
    this._timeout = null;
  }
};

module.exports = WorkerConnection;
