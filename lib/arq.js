'use strict';

// API over RS232 using Stop-and-wait ARQ
// http://en.wikipedia.org/wiki/Stop-and-wait_ARQ
//
// Assumptions:
// - Single frame at a time
// - JSON does not include SOH character

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var SOH = 0x01;
var ACK = 0x06;
var HEADER_LENGTH = 5;  // SOH, sequence bit, bcc, 2-byte length value
var ACK_INTERVAL = 100;
var RETRY_INTERVAL = 100;

var ARQ = function(device) {
  EventEmitter.call(this);

  this.device = device;
  this.partialFrame = null;
  this.rxAlternatingBit = 0x1;
  this.txAlternatingBit = 0x0;
  this.peerAckBit = null;

  var self = this;
  setInterval(function() { self._ack(); }, ACK_INTERVAL);
  self.device.on('data', function(data) { self._processData(data); });
};
util.inherits(ARQ, EventEmitter);

module.exports = ARQ;

ARQ.prototype.send = function send(message, callback) {
  if (this.peerAckBit === this.txAlternatingBit)
    return callback(new Error('Still sending previous frame'));
  var frame = this._buildFrame(message);
  this._sendFrame(frame, callback);
};

function findSohIndex(buffer) {
  for (var i = 0; i < buffer.length; i++) {
    if (buffer[i] === SOH) return i;
  }
  return null;
}

// Works on both buffers and arrays
function computeBcc(frame) {
  var bcc = 0x00;
  for (var i = 0; i < frame.length; i++) {
    bcc = frame[i] ^ bcc;
  }
  return bcc;
}

ARQ.prototype._outOfSequence = function _outOfSequence(sequenceBit) {
  return sequenceBit === this.rxAlternatingBit;
};

ARQ.prototype._parseFrame = function _parseFrame(data) {
  if (data[0] === ACK) {
    if (data.length < 2) return {partialFrame: data};
    return {partialFrame: null, ack: data[1]};
  }

  var sohIndex = findSohIndex(data);
  if (sohIndex === null) return {partialFrame: null};

  // Start frame at SOH
  var frame = data.slice(sohIndex);

  // Need to at least pull the header
  if (frame.length < HEADER_LENGTH) return {partialFrame: frame};

  var sequenceBit = frame.readUInt8(1);
  var length = frame.readUInt16BE(2);
  if (frame.length < length) return {partialFrame: frame};

  // Drop out of sequence frames
  if (this._outOfSequence(sequenceBit)) return {partialFrame: null};

  var bcc = frame[4];
  var body = frame.slice(HEADER_LENGTH, length);
  if (computeBcc(body) !== bcc) throw new Error('BCC error');

  var content = JSON.parse(body);

  this._flipRxBitAck();

  return {
    partialFrame: null,
    content: content
  };
};

ARQ.prototype._processData = function _processData(data) {
  if (data.length === 0) return;
  this.partialFrame = this.partialFrame || new Buffer(0);

  var buffer = Buffer.concat([this.partialFrame, data]);

  var response;
  try {
    response = this._parseFrame(buffer);
  } catch(ex) {
    this.emit('error', ex);
    return;
  }

  this.partialFrame = response.partialFrame;
  if (response.hasOwnProperty('ack')) return this._processAck(response.ack);
  if (response.content) this.emit('message', response.content);
};

ARQ.prototype._processAck = function _processAck(ackBit) {
  this.peerAckBit = ackBit;
};

ARQ.prototype._buildFrame = function _buildFrame(message) {
  var serializedMessage = new Buffer(JSON.stringify(message));
  var bcc = computeBcc(serializedMessage);

  var length = serializedMessage.length + HEADER_LENGTH;

  var header = new Buffer([SOH, this.txAlternatingBit, 0x0, 0x0, 0x0]);
  header.writeUInt16BE(length, 2);
  header[4] = bcc;
  return Buffer.concat([header, serializedMessage], length);
};

ARQ.prototype._sendFrame = function _sendFrame(frame, callback) {
  this.device.write(frame);
  var self = this;
  var intervalRef = setInterval(function() {
    if (self.peerAckBit === self.txAlternatingBit) {   // Message was received
      self._flipTxBit();
      clearInterval(intervalRef);
      callback(null);
      return;
    }
    self.device.write(frame);  // Retry
  }, RETRY_INTERVAL);
};

ARQ.prototype._ack = function _ack() {
  this.device.write([ACK, this.rxAlternatingBit]);
};

ARQ.prototype._flipRxBitAck = function _flipRxBitAck() {
  this.rxAlternatingBit = this.rxAlternatingBit ^ 0x1;
  this.device.write([ACK, this.rxAlternatingBit]);
};

ARQ.prototype._flipTxBit = function _flipTxBit() {
  this.txAlternatingBit = this.txAlternatingBit ^ 0x1;
};
