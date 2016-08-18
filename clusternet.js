#!/usr/bin/env node

var os = require("os");
var network = require("network");
var promise = require("deferred");

var logger = require("./log.js");
var kvstore = require("./kvstore.js");


var ClusterNet = function (config) {
    // load the config file
    this.config = config;
    logger.info("ClusterNet initialised with config", config);
    // open kvstore
    this.store = new kvstore(config);
}

ClusterNet.prototype.getAddress = function () {
    var deferred = promise();
    network.get_interfaces_list(function (err, list) {
        list.forEach(function (interface) {
            logger.debug("found interface", interface.name);
            if (interface.name == "ethwe") {
                logger.debug("selecting interface", interface);
                deferred.resolve(interface.ip_address);
            }
        });
        network.get_active_interface(function (err, interface) {
            logger.debug("selecting interface", interface);
            deferred.resolve(interface.ip_address);
        })
    });
    return deferred.promise();
}

module.exports = {
    ClusterNet: function (service, config, targets) {
        var deferred = promise();
        var clusternet = new ClusterNet(config.cluster);
        clusternet.getAddress().then(function (address) {
            logger.info("address discovered as", address);
            logger.info("our hostname is", os.hostname());
            config.hostname = os.hostname();
            config.address = address;
            deferred.resolve();
        });
        return deferred.promise();
    }
};