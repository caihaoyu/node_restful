var poolModule = require('generic-pool');
var mysql = require('mysql');

//生成连接池
var pool = poolModule.Pool({
    name: 'mysql_pool',
    create: function (callback) {
        var connection = mysql.createConnection({
		  host     : 'localhost',
		  user     : 'root',
		  password : ''
		});

        callback(null, connection);
    },
    destroy: function (connection) {
        connection.end();
    },
    max: 50,
    min : 20,
    idleTimeoutMillis: 1000 * 60 * 3,
    log: true
});

exports.pool = pool;

