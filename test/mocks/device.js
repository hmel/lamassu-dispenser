'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var ACK = 0x06;

var Device = function(server, opts) {
  EventEmitter.call(this);
  if (server) {
    this.peer = server;
    server.peer = this;
  }
  opts = opts || {};
  this.noisy = opts.noisy;
  this.count = 0;
};

util.inherits(Device, EventEmitter);
module.exports = Device;

Device.prototype.write = function write(originalData) {
  var self = this;

  var data = new Buffer(originalData);

  if (this.count === 0 && this.noisy && data[0] !== ACK) data[6] = data[6] ^ 0x4;
  if (this.count === 1 && this.noisy && data[0] !== ACK) data[6] = data[6] ^ 0x3;

  if (data[0] !== ACK) this.count++;
  setTimeout(function () {
    self.peer.incomingMessage(new Buffer(data));
  }, 50);
};

Device.prototype.incomingMessage = function incomingMessage(data) {
  this.emit('data', new Buffer(data));
};
