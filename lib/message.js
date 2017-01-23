/**
 * @param {Object} content
 * @constructor
 */
function Message(content) {
  /** @type {Object} */
  this.content = content;
  /** @type {Number} */
  this.createStamp = new Date().getTime();
}

module.exports = Message;
