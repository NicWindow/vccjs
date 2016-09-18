#!/usr/bin/env node

var os = require("os");
var prependFile = require('prepend-file');
var path = require("path");
var network = require("network");
var promise = require("deferred");

var vccutil = require("./vccutil.js");
var logger = require("./log.js");
var kvstore = require("./kvstore.js");

var dgram = require('dgram');
var ndns = require('./ndns.js');


var ClusterDNS = function (config) {
    // load the config file
    this.config = config;
    logger.info("ClusterDNS initialised with config", config);
    // connect kvstore
    this.kvstore = new kvstore();
    this.kvstore.connect(config.kvstore.host, config.kvstore.port);
    // start up the server
    this.server = ndns.createServer('udp4');
    this.client = ndns.createClient('udp4');
    this.server.on("request", (this.handleQuery).bind(this));
}

ClusterDNS.prototype.bind = function (port, ip) {
    logger.info("ClusterDNS listening on", port, ip);
    this.server.bind(port, ip);
}

ClusterDNS.prototype.prependResolv = function () {
    var deferred = promise();
    // this function adds ourself to the top of /etc/resolv.conf
    prependFile('/etc/resolv.conf', 'nameserver 127.0.0.1\n', function(err) {
        if (err) {
            deferred.reject(err);
        }
        deferred.resolve();
    });
    return deferred.promise();
}

ClusterDNS.prototype.handleQuery = function (req, res) {
    res.setHeader(req.header);
    // check we only got 1 question in this query
    if(req.q.length > 1) {
        logger.warn("ClusterDNS got query with more than 1 question, rejecting");
        res.send();
        return;
    }
    // find the query name
    res.addQuestion(req.q[0]);
    var qname = req.q[0].name;
    logger.debug("ClusterDNS got a query for", qname);
    // look for record in this.kvstore for this name
    var raddress = this.kvstore.get("/cluster/"+this.config.cluster+"/hosts/"+qname);
    if (!raddress) {
        var found = false;
        // see if address is a vccnode alias
        var vccalias = this.kvstore.get("/cluster/"+this.config.cluster+"/hosts/"+qname.replace("vccnode", ""));
        if (vccalias) {
            found = true;
            var raddress = vccalias;
        } else {
            // see if address is a service name, and resolve to service host
            var services = this.kvstore.list("/cluster/"+this.config.cluster+"/services");
            if (services) {
                for (var i = services.length - 1; i >= 0; i--) {
                    if (path.basename(services[i].key) == qname) {
                        // get the record for the host providing this service
                        var raddress = this.kvstore.get("/cluster/"+this.config.cluster+"/hosts/"+services[i].value);
                        if (!raddress) {
                            logger.error("ClusterDNS could not find the host for service", path.basename(services[i].key));
                            res.send();
                            return;
                        } else {
                            found = true;
                        }
                        break;
                    }
                };
            }
        }
        // else reject
        if (!found) {
            logger.warn("ClusterDNS has no record for", qname, ", rejecting");
            res.send();
            return;
        }
    }
    // prepare response
    logger.info("ClusterDNS looked up", qname, "to", raddress);
    res.header.qr = 1;
    res.header.ra = 1;
    res.header.rd = 0;
    res.header.ancount = 1;
    res.header.nscount = 0;
    res.header.arcount = 0;
    res.addRR(qname, 1, "IN", "A", raddress);
    res.send();
}


var clusterdns = new ClusterDNS(vccutil.getConfig());
// prepend ourselves to /etc/resolv.conf and then bind the server
clusterdns.prependResolv().then(function () {
    logger.debug("appended 127.0.0.1 into /etc/resolv.conf");
}, function () {
    logger.error("failed to write /etc/resolv.conf");
    logger.error(err);
});

clusterdns.bind(53, "127.0.0.1");