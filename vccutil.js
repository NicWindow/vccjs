var logger = require("./log.js");
var fs = require('fs');
var path = require('path');
var yaml = require('yamljs');
var promise = require("deferred");
var notify = require('systemd-notify');

exports.systemdNotify = function (status, ready) {
	var deferred = promise();
	var fullconfig = exports.getConfig(true);
	if (fullconfig.systemd) {
		notify({
			ready: ready,
			status: status,
			pid: process.pid
			},
			function(err) {
				if (err) {
					deferred.reject(err);
				} else {
					deferred.resolve();
				}
			}
		);
	}
	return deferred.promise();
}

exports.getRunDir = function () {
	// the run dir where we can find init.yml is in env INIT_RUN_DIR
	var run_dir = process.env['INIT_RUN_DIR'];
	if (!run_dir) {
		logger.warn('No environment variable INIT_RUN_DIR.... assuming /run');
		run_dir = '/run';
	}
	return run_dir;
}

exports.getConfig = function (full, run_dir) {
	if (!run_dir) {
		var run_dir = exports.getRunDir();
	}
	var config = yaml.load(path.join(run_dir, 'init.yml'));
	if (full) {
		return config;
	} else {
		if (config.cluster) {
			return config.cluster;
		} else {
			logger.error("/etc/init.yml does not define cluster configuration!");
			throw "/etc/init.yml has no cluster configuration";
		}
	}
}

exports.writeConfig = function (newconfig) {
	var deferred = promise();
	var run_dir = exports.getRunDir();
	var fullconfig = exports.getConfig(true);
	fullconfig.cluster = newconfig;
	fs.writeFile(path.join(run_dir, 'init.yml'), yaml.stringify(fullconfig), function (err) {
		if (err) {
			deferred.reject(err);
		}
		deferred.resolve();
	});
	return deferred.promise();
}

exports.waitForNetwork = function () {
	// wait for ClusterNet to register the network
	var deferred = promise();
	return deferred.promise();
}
