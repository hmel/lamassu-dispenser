'use strict';

require('chai').should();
var Device = require('./mocks/device');
var serverDevice = new Device();
var clientDevice = new Device(serverDevice);

var ARQ = require('../lib/arq');

var serverArq = new ARQ(serverDevice);
var clientArq = new ARQ(clientDevice);

describe('ARQ', function() {
  it('should send hello world', function(done) {
    serverArq.on('message', function(message) {
      message.should.equal('Hello World!');
      done();
    });
    clientArq.send('Hello World!', function() {});
  });
});
