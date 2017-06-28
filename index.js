'use strict';

//const gwl = require('./gatewayLoader'); //can't do this as GCP won't include in bundle.  Has to be npm package
const braintree = require('braintree');
var config = require("./config.default.json");
const PubSub = require('@google-cloud/pubsub');

const min = 1, max = 1000000; //todo: these need to go in the config
//how to use the google cloud functions emulator: https://cloud.google.com/functions/docs/emulator

exports.getToken = function getToken(req, res) {

  var clientId = req.query ? req.query.clientId : "";
  if (!isValidClient(clientId)) {
    res.status(400).send("Please provide a clientId param in the query string"); return;
  }
  const gateway = loadGateway(clientId);

  res.set('Access-Control-Allow-Origin', "*");
  res.set('Access-Control-Allow-Methods', 'GET, POST');

  gateway.clientToken.generate({}, function (err, response) {
      if (err) {
          console.log(err);
          res.status(400).send(err);
      } else {
          res.set("Content-Type", "application/json");
          res.status(200).send(response);
      }
  });
};

exports.postDonation = function postDonation(req, res) {

  res.set('Access-Control-Allow-Origin', "*");
  res.set('Access-Control-Allow-Methods', 'GET, POST');

  var amount = req.body.amount;
  var orderId = req.body.orderId;
  var fn = req.body.firstname;
  var ln = req.body.lastname;
  var email = req.body.email;
  var ourCompanyName = req.body.clientId;  //not cool but darn handy for our testing purposes
  var nonce = req.body.payment_method_nonce;
  var clientId = req.body.clientId;

  //basic validation to reject attempts before Braintree rejects
  var message = "";
  if (!isValidClient(clientId)) message = message.concat("Please provide a clientId. ");
  if (!isAmountValid(amount)) message = message.concat("Invalid amount - please provide an amount greater than ", min, ". ");
  if (!nonce) message = message.concat("Nonce field cannot be empty. ");
  if (!isEmailValid(email)) message = message.concat("Please ensure you provide a valid email address. ");

  if(message) {
    res.status(400).send("Invalid params in the request body: " + message); return;
  }

  const gateway = loadGateway(clientId);
  gateway.transaction.sale({
    amount: amount,
    orderId: orderId,
    customer: {
        firstName: fn,
        lastName: ln,
        email: email,
        company: ourCompanyName
    },
    paymentMethodNonce: nonce,
    options: {
        submitForSettlement: true
    }
  }, function(err, result) {
    if (err) {
      console.log(err);
      res.status(500).send("Payment gateway rejected this transaction"); return; //todo include err from gateway?
    }
    //https://developers.braintreepayments.com/reference/general/result-objects/node
    if (result.success) {
      console.log("Transaction created with id: " + result.transaction.id);
      //do something!!
      //publishDonationMessage(clientId, { transaction: result, headers: req.headers });
      res.status(200).send("OK"); //todo - decide what to return
    }
    else {
      console.log(result.message);
      res.status(400).send(result.message);
    }
  });

}

function publishDonationMessage(clientId, messageBody) {
  const pubsub = PubSub();
  const topicName = config[clientId].topicName;
  getTopic(pubsub, topicName, function(err, topic) {
    if (err) {
      //todo: if something goes wrong in this function, we should save a backup copy of trans
      console.log(err); return;
    }
    topic.publish({
      data: { message: messageBody }
    }, (err, results) => {
      if (err) {
        //todo: if something goes wrong in this function, we should save a backup copy of trans
        console.log('Error occurred while queuing background task', err);
      } else {
        const messageIds = results[0];
        console.log("Message " + messageIds[0] + " published.");
      }
    });
  });
}

//this will create a bit of latency... better way to ensure topic exists/create topic?
function getTopic (pubsub, topicName, cb) {
  pubsub.createTopic(topicName, (err, topic) => {
    // topic already exists.
    if (err && err.code === 409) {
      cb(null, pubsub.topic(topicName));
      return;
    }
    cb(err, topic);
  });
}

//-- private functions ---------------------

function isValidClient(clientId) {
  if (!clientId) return false;
  var obj = config[clientId];
  if (obj) return true;
  return false;
}

function loadGateway(clientId) {
  console.log("Loading config for " + clientId);
  //check we have config for this
  return braintree.connect({
      environment: braintree.Environment.Sandbox,
      merchantId: config[clientId].merchantId,
      publicKey: config[clientId].publicKey,
      privateKey: config[clientId].privateKey
  });
}

//util functions ------------------------

function isAmountValid(amount) {
  var fAmount = parseFloat(amount);
  if (!fAmount) return false;
  if (fAmount < min || fAmount > max) return false;
  return true;
}

function isEmailValid(email) {
  var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

//** Exports for testing only */
exports._isValidClient = function _isValidClient(clientId) {
  return isValidClient(clientId);
}
exports._loadGateway = function _loadGateway(clientId) {
  return loadGateway(clientId);
}
exports._isAmountValid = function _isAmountValid(amount) {
  return isAmountValid(amount);
}
exports._isEmailValid = function _isEmailValid(email) {
  return isEmailValid(email);
}
