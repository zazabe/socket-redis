var _ = require('underscore');
var Message = require('./message');

/**
 * @param {String} id
 * @constructor
 */
function Channel(id) {
  this.id = id;
  /** @type {Subscriber[]} */
  this.subscribers = [];
  /** @type {Message[]} */
  this.msgs = [];
  /** @type {Number|null} */
  this.closeTimeout = null;
}

/**
 * @param {WorkerConnection} connection
 */
Channel.prototype.unsubscribe = function(connection) {
  this.subscribers = _.reject(this.subscribers, function(subscriber) {
    return subscriber.connection === connection;
  });
};

/**
 * @returns {Boolean}
 */
Channel.prototype.hasSubscribers = function() {
  return this.subscribers.length > 0;
};

/**
 * @returns {Subscriber[]}
 */
Channel.prototype.getSubscribers = function() {
  return this.subscribers;
};

/**
 * @param {Subscriber} subscriber
 */
Channel.prototype.addSubscriber = function(subscriber) {
  this.subscribers.push(subscriber);
};

/**
 * @returns {Message[]}
 */
Channel.prototype.getMessages = function() {
  return this.msgs;
};

/**
 * @param {Object} content
 */
Channel.prototype.addMessage = function(content) {
  this.msgs.push(new Message(content));
  if (this.msgs.length > 10) {
    this.msgs.splice(0, this.msgs.length - 10);
  }
};

module.exports = Channel;
