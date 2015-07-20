var poolModule = require('generic-pool');
var redis = require("redis");
var mysql = require('mysql');


//生成连接池
var redis_pool = poolModule.Pool({
    name: 'redis_pool',
    create: function (callback) {
        var client = redis.createClient();
        callback(null, client);
    },
    destroy: function (client) {
        client.quit();
    },
    max: 50,
    // min:10,
    idleTimeoutMillis: 1000 * 60 * 3,
    log: false
});

//生成连接池
var mysql_pool = poolModule.Pool({
    name: 'mysql_pool',
    create: function (callback) {
        var connection = mysql.createConnection({
          host     : 'localhost',
          user     : 'root',
          password : '',
          database : 'worker_home'
        });

        callback(null, connection);
    },
    destroy: function (connection) {
        connection.end();
    },
    max: 100,
    idleTimeoutMillis: 1000 * 60 * 30,
    log: false
});

exports.mysql_pool = mysql_pool;

exports.redis_pool = redis_pool;