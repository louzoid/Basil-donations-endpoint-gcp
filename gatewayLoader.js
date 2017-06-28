'use strict';

const braintree = require('braintree');
var config = require("./config.default.json");

function GatewayLoader() {
  var self = this;

  self.load = function(clientId) {
    //todo: do something with clientId e.g. load appropriate config
    console.log("Loading config for " + clientId);
    return braintree.connect({
        environment: braintree.Environment.Sandbox,
        merchantId: config.merchantId,
        publicKey: config.publicKey,
        privateKey: config.privateKey
    });
  }
}

module.exports = GatewayLoader;
