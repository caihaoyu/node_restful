var cluster=require('cluster');
var os=require('os');

var numOfCpus=os.cpus().length;


var workers={};

if(cluster.isMaster){
	cluster.on('death',function (worker){
		delete workers[woeker.pid];
		worker=cluster.fork();
		workers[worker.pid]=worker;
	});
	for(var i=0;i<numOfCpus;i++){
		var worker=cluster.fork();
		workers[worker.pid]=worker;
	}
}else{
	var app=require('./app');
	app.listen(8081);
}
process.on(
	'SIGTERM',function(){
		for(var pid in workers){
			process.kill(pid);
	}
	process.exit(0);
});