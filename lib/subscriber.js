/**
 * @param {WorkerConnection} connection
 * @param {Object} data
 * @constructor
 */
function Subscriber(connection, data) {
  /** @type {WorkerConnection} */
  this.connection = connection;
  /** @type {Object} */
  this.data = data;
  /** @type {Number} */
  this.createStamp = new Date().getTime();
}

module.exports = Subscriber;
