var redis = require('redis');
var http = require('http');
var _ = require('underscore');
var StatusRequest = require('./status-request.js');
var validator = require('validator');

/**
 * @param {String} redisHost
 * @param {Number} statusPort
 * @constructor
 */
function Server(redisHost, statusPort) {
  /** @type {Object.<String, ChildProcess>} */
  this._workers = {};
  /** @type {Object.<String, StatusRequest>} */
  this._statusRequests = {};

  /** @type {RedisClient} */
  this._redisClientDown = this._createRedisClientDown(redisHost);
  /** @type {RedisClient} */
  this._redisClientUp = this._createRedisClientUp(redisHost);
  /** @type {http.Server} */
  this._statusServer = this._createStatusServer(statusPort);
}

Server.prototype.stop = function() {
  this._killWorkers();
  this._redisClientDown.quit();
  this._redisClientUp.quit();
  this._statusServer.close();
};

/**
 * @param {StatusRequest} statusRequest
 */
Server.prototype.addStatusRequest = function(statusRequest) {
  this._statusRequests[statusRequest.getId()] = statusRequest;
};

/**
 * @param {String} requestId
 * @returns {StatusRequest|null}
 */
Server.prototype.getStatusRequest = function(requestId) {
  return this._statusRequests[requestId] || null;
};

/**
 * @returns {Object.<String, StatusRequest>}
 */
Server.prototype.getStatusRequests = function() {
  return this._statusRequests;
};

/**
 * @param {StatusRequest} statusRequest
 */
Server.prototype.removeStatusRequest = function(statusRequest) {
  delete this._statusRequests[statusRequest.getId()];
};

/**
 * @param {ChildProcess} worker
 */
Server.prototype.addWorker = function(worker) {
  this._workers[worker.pid] = worker;
};

/**
 * @param {ChildProcess} worker
 */
Server.prototype.removeWorker = function(worker) {
  delete this._workers[worker.pid];
};

/**
 * @param {String} type
 * @param {Object} data
 */
Server.prototype.triggerEventUp = function(type, data) {
  switch (type) {
    case 'up-message':
      this._sendUpMessage(data.clientKey, data.data);
      break;
    case 'up-publish':
      this._sendDownPublish(data.channel, data.event, data.data);
      break;
    case 'up-subscribe':
      this._sendUpSubscribe(data.channel, data.clientKey, data.data);
      break;
    case 'up-unsubscribe':
      this._sendUpUnsubscribe(data.channel, data.clientKey);
      break;
    case 'up-status-request':
      var request = this.getStatusRequest(data.requestId);
      if (!request) {
        break;
      }
      request.addResponse(data.channels);
      break;
    default:
      console.log('Invalid up event type: `' + type + '`');
      break;
  }
};

/**
 * @param {String} type
 * @param {Object} data
 */
Server.prototype._sendUp = function(type, data) {
  this._redisClientUp.publish('socket-redis-up', JSON.stringify({type: type, data: data}));
};

/**
 * @param {String} type
 * @param {Object} data
 */
Server.prototype._sendDown = function(type, data) {
  _.each(this._workers, function(worker) {
    worker.send({type: type, data: data});
  });
};

/**
 * @param {String} clientKey
 * @param {Object} data
 */
Server.prototype._sendUpMessage = function(clientKey, data) {
  this._sendUp('message', {clientKey: clientKey, data: data});
};

/**
 * @param {String} channel
 * @param {String} clientKey
 * @param {Object} data
 */
Server.prototype._sendUpSubscribe = function(channel, clientKey, data) {
  this._sendUp('subscribe', {channel: channel, clientKey: clientKey, data: data});
};

/**
 * @param {String} channel
 * @param {String} clientKey
 */
Server.prototype._sendUpUnsubscribe = function(channel, clientKey) {
  this._sendUp('unsubscribe', {channel: channel, clientKey: clientKey});
};

/**
 * @param {String} channel
 * @param {String} event
 * @param {Object} data
 */
Server.prototype._sendDownPublish = function(channel, event, data) {
  this._sendDown('down-publish', {channel: channel, event: event, data: data});
};

/**
 * @param {StatusRequest} request
 */
Server.prototype._sendDownStatusRequest = function(request) {
  this._sendDown('down-status-request', {requestId: request.getId()});
};

/**
 * @param {String} host
 * @returns {RedisClient}
 */
Server.prototype._createRedisClientDown = function(host) {
  var client = this._createRedisClient(host, 'down');
  client.on('connect', function() {
    client.subscribe('socket-redis-down');
  });
  client.on('message', function(channel, event) {
    try {
      this._handleClientDownMessage(event)
    } catch (error) {
      console.error('Error processing Redis data: ' + error);
    }
  }.bind(this));

  return client;
};

/**
 * @param {String} host
 * @returns {RedisClient}
 */
Server.prototype._createRedisClientUp = function(host) {
  return this._createRedisClient(host, 'up')
};

/**
 * @param {String} host
 * @param {String} alias
 * @returns {RedisClient}
 */
Server.prototype._createRedisClient = function(host, alias) {
  var client = redis.createClient(6379, host, {retry_max_delay: 60000});

  ['error', 'warning', 'connect', 'ready', 'reconnecting', 'end'].forEach(function(event) {
    client.on(event, function() {
      var connectionStub = '  ' + alias + '#' + client.connection_id;
      var functionArguments = Array.prototype.slice.call(arguments);
      console.log.apply(null, [connectionStub, event].concat(functionArguments));
    });
  });

  return client;
};

/**
 * @param {Object} event
 */
Server.prototype._handleClientDownMessage = function(event) {
  event = JSON.parse(event);
  var eventData = event.data;
  switch (event.type) {
    case 'publish':
      if (typeof eventData.data === 'undefined') {
        eventData.data = null;
      }
      if (validator.isNull(eventData.channel) || validator.isNull(eventData.event)) {
        throw new Error('Missing channel or event: `' + JSON.stringify(eventData) + '`')
      }
      this._sendDownPublish(eventData.channel, eventData.event, eventData.data);
      break;
    default:
      console.error('Invalid down event type: `' + event.type + '`');
      break;
  }
};

/**
 * @param {Number} statusPort
 * @returns {http.Server}
 */
Server.prototype._createStatusServer = function(statusPort) {
  var server = http.createServer(this._handleStatusRequest.bind(this));
  server.on('connection', function(socket) {
    socket.setTimeout(10000);
  });
  server.listen(statusPort);
  return server;
};

/**
 * @param {http.ClientRequest} request
 * @param {http.ServerResponse} response
 */
Server.prototype._handleStatusRequest = function(request, response) {
  var statusRequest = new StatusRequest(_.size(this._workers));
  this.addStatusRequest(statusRequest);
  var self = this;
  statusRequest.on('complete', function() {
    response.end(JSON.stringify(statusRequest.getChannelsData()));
    self.removeStatusRequest(statusRequest);
  });
  request.on('close', function() {
    self.removeStatusRequest(statusRequest);
  });
  this._sendDownStatusRequest(statusRequest);
};

Server.prototype._killWorkers = function() {
  _.each(this._workers, function(worker) {
    worker.kill();
  });
};

module.exports = Server;