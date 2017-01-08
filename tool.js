#!/usr/bin/env node

var yaml = require("yamljs");
var glob = require('glob');

// define the required arguments
opt = require('node-getopt').create([
  ['', 'cluster=NAME', 'name of cluster to join'],
  ['', 'storage-type=TYPE', 'storage service type, supports: etcd'],
  ['', 'storage-host=IP', 'ip address of storage host'],
  ['', 'storage-port=PORT', 'port of storage service'],
  ['', 'service=SERVICE', 'for a multi service image, specify the service to start'],
  ['', 'force-address=IP', 'manually set the advertised IP of this instance'],
  ['', 'no-dns', 'don\'t use the ClusterDNS service'],
  ['', 'usermode', 'always run services as the calling user'],
  //['', 'eval', 'format output suitable to eval in the host shell'],
  ['', 'just-yml', 'just dump the generated cluster init.yml and nothing else'],
  ['i', 'info', 'display information about this vcc image'],
  ['h', 'help', 'display this help'],
  ['v', 'version', 'show version']
]); // parse command line


var options = opt.parseSystem().options;

// help command
if (options.help) {
    opt.showHelp();
    process.exit(1);
}

// version command
if (options.version) {
    console.log("vccjs tool 0.1");
    console.log("▒▒▒▒▒▒▒▓");
    console.log("▒▒▒▒▒▒▒▓▓▓");
    console.log("▒▓▓▓▓▓▓░░░▓");
    console.log("▒▓░░░░▓░░░░▓");
    console.log("▓░░░░░░▓░▓░▓");
    console.log("▓░░░░░░▓░░░▓");
    console.log("▓░░▓░░░▓▓▓▓");
    console.log("▒▓░░░░▓▒▒▒▒▓");
    console.log("▒▒▓▓▓▓▒▒▒▒▒▓");
    console.log("▒▒▒▒▒▒▒▒▓▓▓▓");
    console.log("▒▒▒▒▒▓▓▓▒▒▒▒▓");
    console.log("▒▒▒▒▓▒▒▒▒▒▒▒▒▓");
    console.log("▒▒▒▓▒▒▒▒▒▒▒▒▒▓");
    console.log("▒▒▓▒▒▒▒▒▒▒▒▒▒▒▓");
    console.log("▒▓▒▓▒▒▒▒▒▒▒▒▒▓");
    console.log("▒▓▒▓▓▓▓▓▓▓▓▓▓");
    console.log("▒▓▒▒▒▒▒▒▒▓");
    console.log("▒▒▓▒▒▒▒▒▓ ");
    process.exit(1);
}
// info command
if (options.info) {
    // get some basic details about this image
    var inityml = yaml.load("/etc/init.yml");
    var info = {};
    if(!inityml.cluster.image_info) {
        console.error("This image does not define any author info in the init.yml");
    } else {
        info['Name'] = inityml.cluster.image_info.name;
        info['Version'] = inityml.cluster.image_info.version;
        info['Author'] = inityml.cluster.image_info.author;
    }
    // check for multi service image
    info['Services'] = {};
    info.Services['Default'] = inityml.cluster.service;
    info.Services['Available'] = [];
    files = glob.sync("/etc/vcc/services-*.yml");
    for (var i = files.length - 1; i >= 0; i--) {
        info.Services.Available.push(files[i].replace("/etc/vcc/services-", "").replace(".yml", ""));
    };
    
    // check for service providers and dependencies
    try {
        var deps = yaml.load("/etc/vcc/dependencies.yml");
    } catch (err) {
        var deps = {};
    }
    info.Services['Dependencies'] = deps;
    // print out in yaml
    console.log(yaml.stringify(info, 8));
    process.exit(1);
}

// otherwise, start the VCC!
// check cluster name is specified
if (!options.cluster) {
    console.error("You must specify a cluster name using --cluster=NAME");
    process.exit(1);
}
// check we have either --start-storage or --storage-host and --storage-port
if (!(options['storage-host'] && options['storage-port'])) {
    console.error("You must specify --storage-host and --storage-port");
    process.exit(1);
}
// generate yml config with cluster name and storage details in
// since the tool is executed within the image itself, we can just look at /etc/init.yml
var inityml = yaml.load("/etc/init.yml");
// storage settings
if(!options['storage-type']) {
    inityml.cluster.kvstore.type = "etcd";
} else {
    inityml.cluster.kvstore.type = options['storage-type'];
}
inityml.cluster.kvstore.host = options['storage-host'];
inityml.cluster.kvstore.port = options['storage-port'];
// address override
if(options['force-address']) {
    inityml.cluster.myaddress = options['force-address'];
}
// cluster dns
if(options['no-dns'] || options.usermode) {
    inityml.cluster.nodns = true;
}
// set cluster name and service
inityml.cluster.cluster = options.cluster;
if (options.service) {
    inityml.cluster.service = options.service;
}
// convert to yaml and then base64 encode
var b64inityml = new Buffer(yaml.stringify(inityml)).toString('base64');
// generate command for starting this image
var runcommand = "/init8js/init.js ";
// add usermode option if required
if (options.usermode) {
    runcommand += "usermode ";
}
runcommand += "b64inityml="+b64inityml;
// output the commands in the desired format
if (options['just-yml']) {
    console.log(yaml.stringify(inityml));
    process.exit(1);
} else {
    console.log(runcommand);
    process.exit(0);
}