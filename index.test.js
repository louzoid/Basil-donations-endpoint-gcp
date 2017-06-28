'use strict';
//unit tests only. Todo: integration tests using real comms with Braintree

var chai = require("chai"), //assertions
  should = chai.should(), // eslint-disable-line no-unused-vars
  sinon = require("sinon"), //spies & stubs
  //expect = chai.expect,
  proxyquire = require("proxyquire").noCallThru(); //so you can stub 'require' objs

var gateway = { clientToken: { }, transaction: { } };
const connect = sinon.stub().returns(gateway);
const braintree = { connect: connect, Environment: { Sandbox: "" } };
const topic = { publish: sinon.stub().returns(Promise.resolve()) };
const pubsub = { topic: sinon.stub().returns(topic) };

const clientId = "stroke-association";

function getProgram() {
  return  { sample: proxyquire('./index', { 'braintree' : braintree, '@google-cloud/pubsub' : pubsub }) }
}

function getMocks() {
  //var send = sinon.stub().returnsThis();
  return {
    req: {
      query: {},
      body: {}
    },
    res: {
      status: sinon.stub().returnsThis(),
      set: sinon.stub().returnsThis(),
      send: sinon.stub().returnsThis()
    }
  };
}

describe("Token tests", function () {

  /*  beforeEach(function() {
    tools.stubConsole;
  });
  afterEach(function() {
    tools.restoreConsole;
  });*/

  it('should return a 400 error if no clientId is provided', function() {
    const mocks = getMocks();
    const p = getProgram().sample;
    p.getToken(mocks.req, mocks.res);
    mocks.res.status.firstCall.args[0].should.equal(400);
    mocks.res.send.calledOnce.should.equal(true);
  });

  it('should return a 400 if config is invalid', function () {
    const p = getProgram().sample;
    p._isValidClient("nonvalidid").should.equal(false);
  });

  it('should return a 200 if config is valid', function () {
    const p = getProgram().sample;
    p._isValidClient(clientId).should.equal(true);
  });

  it('should return a 400 if braintree returns an error', function() {
    const mocks = getMocks();
    mocks.req.query.clientId = clientId;
    const p = getProgram().sample;
    gateway.clientToken.generate = sinon.stub().yields({ err: "oh dear" }, {});
    p.getToken(mocks.req, mocks.res);
    mocks.res.send.calledOnce.should.equal(true);
    mocks.res.status.firstCall.args[0].should.equal(400);
  });

});

describe("Util function tests", function () {
    it('should return false if a non valid number is provided', function () {
    const p = getProgram().sample;
    p._isAmountValid('icknum').should.equal(false);
  });

  it('should return false if a number less than 1 is supplied', function () {
    const p = getProgram().sample;
    p._isAmountValid(0.43).should.equal(false);
  });

  it('should return false if a number greater than 1 million is supplied', function () {
    const p = getProgram().sample;
    p._isAmountValid(1000001).should.equal(false);
  });

  it('should return true is a valid amount is supplied', function () {
    const p = getProgram().sample;
    p._isAmountValid(10.95).should.equal(true);
  });

  it('should return false if a no email address supplied', function () {
    const p = getProgram().sample;
    p._isEmailValid().should.equal(false);
  });

  it('should return false if an invalid email address supplied', function () {
    const p = getProgram().sample;
    p._isEmailValid('jobloggs-jobloggs.com').should.equal(false);
  });

  it('should return true if a valid email address is supplied', function () {
    const p = getProgram().sample;
    p._isEmailValid('louise.ryan@addition.london').should.equal(true);
  });
});

describe("Donation tests", function () {

  const goodBodyParams = { clientId: clientId, payment_method_nonce: "nonce", amount: 3, email: "louise.ryan@addition.london" };

  it('should return a 500 if gateway returns an error object', function() {
    const mocks = getMocks();
    mocks.req.body = goodBodyParams;
    const p = getProgram().sample;
    gateway.transaction.sale = sinon.stub().yields({ err: "oh dear" }, {});
    p.postDonation(mocks.req, mocks.res);
    mocks.res.send.calledOnce.should.equal(true);
    mocks.res.send.firstCall.args[0].should.equal("Payment gateway rejected this transaction");
    mocks.res.status.firstCall.args[0].should.equal(500);
  });

  it('should return a 400 if gateway returns success = false', function() {
    const mocks = getMocks();
    mocks.req.body = goodBodyParams;
    const p = getProgram().sample;
    gateway.transaction.sale = sinon.stub().yields(null, { success: false,});
    p.postDonation(mocks.req, mocks.res);
    mocks.res.send.calledOnce.should.equal(true);
    mocks.res.status.firstCall.args[0].should.equal(400);
  });

  it('should return a 200 if gateway returns success = true', function() {
    const mocks = getMocks();
    mocks.req.body = goodBodyParams;
    const p = getProgram().sample;
    gateway.transaction.sale = sinon.stub().yields(null, { success: true, transaction: { id:"fauxId"} });
    p.postDonation(mocks.req, mocks.res);
    mocks.res.send.calledOnce.should.equal(true);
    mocks.res.status.firstCall.args[0].should.equal(200);
  });

});
