'use strict';

var should = require('chai').should();
var Device = require('./mocks/device');
var ARQ = require('../lib/arq');

function createARQs(opts) {
  opts = opts || {};
  var serverDevice = new Device();
  var clientDevice = new Device(serverDevice, opts);
  var serverArq = new ARQ(serverDevice);
  var clientArq = new ARQ(clientDevice);

  clientArq.on('error', function() {});
  serverArq.on('error', function() {});

  return {client: clientArq, server: serverArq};
}

describe('ARQ', function() {

  it('should send hello world', function(done) {
    var arqs = createARQs();
    arqs.server.on('message', function(message) {
      message.should.equal('Hello World!');
      done();
    });
    arqs.client.send('Hello World!', function() {});
  });

  it('should send hello world on noisy channel', function(done) {
    var arqs = createARQs({noisy: true});
    arqs.server.on('message', function(message) {
      message.should.equal('Hello World!');
      done();
    });
    arqs.client.send('Hello World!', function() {});
  });

  it('should fail sending two messages, fast', function(done) {
    var arqs = createARQs();

    arqs.server.on('message', function() {});
    arqs.client.send('Hello World!', function() {});
    setTimeout(function() {
      arqs.client.send('World Hello!', function (err) {
        should.exist(err);
        err.message.should.equal('Previous send in progress');
        done();
      });
    }, 50);
  });

  it('should send two messages, slowly', function(done) {
    var arqs = createARQs();

    var messages = [];
    arqs.server.on('message', function(message) {
      messages.push(message);
      if (messages.length === 2) {
        messages[0].should.equal('Hello World!');
        messages[1].should.equal('World Hello!');
        done();
      }
    });
    arqs.client.send('Hello World!', function() {});
    setTimeout(function() {
      arqs.client.send('World Hello!', function() {});
    }, 300);
  });

  it('should send three messages, slowly', function(done) {
    var arqs = createARQs();

    var messages = [];
    arqs.server.on('message', function(message) {
      messages.push(message);
      if (messages.length === 3) {
        messages[0].should.equal('Hello World!');
        messages[1].should.equal('World Hello!');
        messages[2].should.equal('World Hello 3!');
        done();
      }
    });
    arqs.client.send('Hello World!', function() {});
    setTimeout(function() {
      arqs.client.send('World Hello!', function() {});
      setTimeout(function() {
        arqs.client.send('World Hello 3!', function() {});
      }, 300);
    }, 300);
  });
});
