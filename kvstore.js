var promise = require("deferred");
var Etcd = require("node-etcd");
var logger = require("winston");
var path = require("path");


function VccStore () {
	this.connected = false;
}

VccStore.prototype.connect = function (host, port) {
	var conn = "http://"+host+":"+port;
	logger.debug("kvstore is connecting to", conn);
	this.etcd = new Etcd(conn, {timeout: 5000});
	this.connected = true;
}

VccStore.prototype.set = function (key, value, ttl) {
	var deferred = promise();
	if (!this.connected) {
		deferred.reject("not connected");
	}
	// set the key optionally with ttl
	logger.debug("key set:", key, value, ttl);
	var options = {};
	if (ttl) {
		options.ttl = ttl;
	}
	// call the etcd function
	this.etcd.set(key, value, options, function (err, res) {
		if (err) {
			deferred.reject(err);
		} else {
			deferred.resolve();
		}
	});
	// return promise
	return deferred.promise;
}

VccStore.prototype.get = function (key, recursive, recursive_with_vals) {
	var deferred = promise();
	var me = this;
	if (!this.connected) {
		deferred.reject("not connected");
	}
	logger.debug("key get:", key, recursive);
	var options = {};
	if (recursive) {
		options.recursive = true;
	}
	// call the etcd function
	this.etcd.get(key, function (err, res) {
		if (err) {
			deferred.reject(err);
		} else {
			// check the response
			if (res.node) {
				if (recursive) {
					if (res.node.nodes) {
						// convert a list of objects into the required format
						// only show the base name of the full path
						if (recursive_with_vals) {
							// we need an object with {key: value}
							var listresult = res.node.nodes.reduce(function (r, i) {
								if (!i.dir) {
									r[path.basename(i.key)] = i.value;
								}
								return r;
							}, {});
						} else {
							// we just need list of keys
							var listresult = res.node.nodes.reduce(function (r, i) {
								r.push(path.basename(i.key));
								return r;
							}, []);
						}
						deferred.resolve(listresult);
					} else {
						deferred.reject("recursive, expecting nodes but didn't get any");
					}
				} else {
					if (res.node.dir) {
						deferred.reject(res.node.key + " is a directory");
					} else if (res.node.value) {
						deferred.resolve(res.node.value);
					} else {
						deferred.reject("no value in response");
					}
				}
			} else {
				deferred.reject("no node in response");
			}
		}
	});
	// return promise
	return deferred.promise;
}

VccStore.prototype.watch = function (key) {
	var deferred = promise();
	if (!this.connected) {
		deferred.reject("not connected");
	}
	// returns an event emitter on change
	logger.debug("key watch:", key);
	deferred.resolve(this.etcd.watcher(key));
	// return promise
	return deferred.promise;
}

VccStore.prototype.list = function (key, with_vals) {
	// call the get function with recursive option
	// with_vals allows us to get the values when listing in the same call
	return this.get(key, true, with_vals);
}

VccStore.prototype.register = function (key, value, ttl) {
	var deferred = promise();
	// this promise resolves after the first set is complete
	if (!this.connected) {
		deferred.reject("kvstore is not connected");
	}
	logger.debug("key register:", key, value, ttl, "refresh in", (ttl*1000)-10000, "ms");
	var me = this;
	this.set(key, value, ttl).then(function () {
		// success, now register a timeout
		setTimeout(function() {
			me.register(key, value, ttl);
		}, (ttl*1000)-10000);
		// resolve the promise
		deferred.resolve();
	}, function (err) {
		deferred.reject(err);
	});
	return deferred.promise;
}

module.exports = VccStore;