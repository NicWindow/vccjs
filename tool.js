#!/usr/bin/env node

var yaml = require("yamljs");

// define the required arguments
opt = require('node-getopt').create([
  ['', 'start', 'start the image'],
  ['', 'cluster=NAME', 'name of cluster to join'],
  ['', 'start-storage', 'start a storage service for this vcc, otherwise, use --storage-[host,port] option'],
  ['', 'storage-host=IP', 'ip address of storage host'],
  ['', 'storage-port=PORT', 'port of storage service'],
  ['', 'service=SERVICE', 'for a multi service image, specify the service to start'],
  ['', 'force-address=IP', 'manually set the advertised IP of this instance'],
  ['', 'no-dns', 'don\'t use the ClusterDNS service'],
  ['', 'privileged', 'run the containers in privileged mode (e.g. for NFS)'],
  ['', 'hostnet', 'use the host networking model'],
  ['', 'name', 'give container the name vcc-[cluster]-[service] (useful for scripting)'],
  ['', 'bind=PATH', 'bind mount folder from host into container'],
  ['', 'restart', 'set the Docker option to automatically restart container'],
  ['', 'justdoit', 'set options privileged, hostnet, name, bind=/home, restart'],
  ['', 'swarm', 'specify the standalone Docker Swarm to use for provisioning'],
  ['', 'swarm-node-exclusive', 'only provision one container per node for this cluster in the swarm'],
  //['', 'eval', 'format output suitable to eval in the host shell'],
  ['', 'just-yml', 'just dump the generated cluster init.yml and nothing else'],
  ['i', 'info', 'display information about this vcc image'],
  ['h', 'help', 'display this help'],
  ['v', 'version', 'show version']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line


var options = opt.options;

//console.log(options);

if ((options.version || options.info || options.start)) {
    // version command
    if (options.version) {
        console.log("vcc version 0.1");
        /*console.log("                                _");
        console.log("                               | \\");
        console.log("  meow                         | |");
        console.log("                               | |");
        console.log("           |\\                  | |");
        console.log("          /, ~\                / /");
        console.log("         X     `-.....-------./ /");
        console.log("          ~-. ~  ~              |");
        console.log("             \\             /    |");
        console.log("              \\  /_     ___\\   /");
        console.log("              | /\\ ~~~~~   \\  |");
        console.log("              | | \\        || |");
        console.log("              | |\\ \\       || )");
        console.log("             (_/ (_/      ((_/");*/
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
        process.exit(0);
    }
    // info command
    if (options.info) {

    }
    // generate command for starting the storage if we need to
    if (options['start-storage']) {
        var storagecommand = "docker run -d ";
        if (options.hostnet) {
            storagecommand += "--net=host ";
        }
        if (options.name) {
            storagecommand += "--name=vcc-"+options.cluster+"-kvstore ";
        }
        storagecommand += "quay.io/coreos/etcd:v3.0.8 /usr/local/bin/etcd --listen-client-urls 'http://0.0.0.0:2379,http://0.0.0.0:4001' --advertise-client-urls 'http://0.0.0.0:2379,http://0.0.0.0:4001'";
        console.log(storagecommand);
    }
    // start command, the good stuff happens here
    if (options.start) {
        // check cluster name is specified
        if (!options.cluster) {
            console.error("You must specify a cluster name");
            process.exit(1);
        }
        if (options.justdoit) {
            options.privileged = true;
            options.hostnet = true;
            options.name = true;
            options.bind = "/home";
            options.restart = true;
        }
        // check we have either --start-storage or --storage-host and --storage-port
        if (!options['start-storage']) {
            if (!(options['storage-host'] && options['storage-port'])) {
                console.error("You must specify either --start-storage OR --storage-host and --storage-port");
            }
        }
        // generate yml config with cluster name and storage details in
        // since the tool is executed within the image itself, we can just look at /etc/init.yml
        var inityml = yaml.load("/etc/init.yml");
        inityml.cluster.kvstore.type = "etcd";
        if (!options['start-storage']) {
            inityml.cluster.kvstore.host = options['storage-host'];
            inityml.cluster.kvstore.port = options['storage-port'];
        } else {
            inityml.cluster.kvstore.host = "localhost";
            inityml.cluster.kvstore.port = "4001";
        }
        if(options['force-address']) {
            inityml.cluster.myaddress = options['force-address'];
        }
        if(options['no-dns']) {
            inityml.cluster.nodns = true;
        }
        inityml.cluster.cluster = options.cluster;
        if (options.service) {
            inityml.cluster.service = options.service;
        }
        var b64inityml = new Buffer(yaml.stringify(inityml)).toString('base64');
        // generate command for starting this image
        if (options.swarm) {
            var runcommand = "docker -H "+options.swarm+" run -d ";
        } else {
            var runcommand = "docker run -d ";
        }
        if (options.privileged) {
            runcommand += "--privileged ";
        }
        if (options.hostnet) {
            runcommand += "--net=host ";
        }
        if (options['swarm-node-exclusive']) {
            runcommand += '--label="vcc'+options.cluster'" -e "affinity:container!=*vcc'+options.cluster'*" ';
        }
        if (options.name) {
            runcommand += "--name=vcc-"+options.cluster+"-"+options.service+" ";
        }
        if (options.bind) {
            runcommand += "-v "+options.bind+":"+options.bind+" ";
        }
        runcommand += "$VCCIMAGE b64inityml="+b64inityml;
        // output the commands in the desired format
        if (options['just-yml']) {
            console.log(yaml.stringify(inityml));
        } else {
            console.log(runcommand);
        }
    }
} else {
    console.error("You must either start the image or use one of the [info|help|version] options");
    process.exit(1);
}
