'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Device = function(server) {
  EventEmitter.call(this);
  if (server) {
    this.peer = server;
    server.peer = this;
  }
};

util.inherits(Device, EventEmitter);
module.exports = Device;

Device.prototype.write = function write(data) {
  var self = this;
  setTimeout(function () {
    self.peer.incomingMessage(new Buffer(data));
  }, 50);
};

Device.prototype.incomingMessage = function incomingMessage(data) {
  this.emit('data', new Buffer(data));
};
