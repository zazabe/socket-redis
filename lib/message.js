/**
 * @param {Object} content
 * @constructor
 */
function Message(content) {
  /** @type {Object} */
  this.content = content;
  /** @type {Number} */
  this.timestamp = new Date().getTime();
}

module.exports = Message;
