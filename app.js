var restify = require('restify');
var pool = require("./pool");
var redis_pool = pool.redis_pool;
var mysql_pool = pool.mysql_pool;
var CronJob = require('cron').CronJob;


var server = restify.createServer({
    name: 'worker_home',
    version: '1.0.0'
});
var rest_client = restify.createJsonClient({
    url: 'http://localhost:8080'
});
var rest_client2 = restify.createJsonClient({
    url: 'http://localhost:8887'
});
server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

server.get('/test/:id', function (req, res, next) {
    postScoreOpthons();
    res.send(req.params.id);
    return next();
});

server.post('/test', function (req, res, next) {
    //转换request body为json格式
    var body = req.body;
    res.send(200, body);
    return next();


});

server.post('/api/workerhome/activephoto/tuisong', function (req, res, next) {

    var body = {};
    if (typeof(req.body) == "string") {
        // console.log("init");
        body = JSON.parse(req.body.toString());

    } else if (typeof(req.body) == "object") {
        body = req.body;

    }

    tuiSong(body);
    res.send({'flag': true, 'msg': '成功'});
    return next();


});

server.post('/api/workerhome/active/score', function (req, res, next) {
    //转换request body为json格式
    var body = {};
    if (typeof(req.body) == "string") {
        // console.log("init");
        body = JSON.parse(req.body.toString());

    } else if (typeof(req.body) == "object") {
        body = req.body;

    }
    addScore(body, function (flag, message, result) {
        res.send({'flag': flag, 'msg': message, 'result': result});
        return next();

    });


});

server.get('/api/workerhome/active/sign/isSign/:aid/:uid', function (req, res, next) {
    var body = {};
    body.userId = req.params.uid;
    body.activeId = req.params.aid;
    //转换request body为json格式
    isSign(body, function (flag) {
        if (flag == true) {
            res.send({'flag': true, 'msg': '已经签到'});
            return next();

        } else {
            res.send({'flag': false, 'msg': '未签到'});
            return next();

        }
    });
});

server.post('/api/workerhome/active/sign', function (req, res, next) {
    var body = {};
    if (typeof(req.body) == "string") {
        // console.log("init");
        body = JSON.parse(req.body);

    } else if (typeof(req.body) == "object") {
        body = req.body;

    }
    if (body.activeId && body.userId && body.bumenId) {
        var sign = {};
        sign.user_id = body.userId;
        sign.active_id = body.activeId;
        sign.bumen_id = body.bumenId;
        sign.sign_date = new Date();
        isSign(body, function (flag) {
            if (!flag) {
                mysql_pool.acquire(function (err, connection) {
                    connection.query('INSERT INTO sign SET ?', [sign], function (err, result) {
                        if (err) {
                            console.log(err);
                            mysql_pool.release(connection);
                            res.send(500, {'flag': false, 'msg': '服务器错误'});
                            return next();
                        } else {
                            //console.log(result);
                            body.hdType = "h_sign";
                            addScore(body, function (flag2, result) {
                                //回调空
                            });
                            mysql_pool.release(connection);
                            res.send({'flag': true, 'msg': '操作成功'});
                            return next();

                        }


                    });
                });
            } else {
                res.send({'flag': false, 'msg': '该用户已经签到'});
                return next();
            }
        });

    } else {
        res.send({'flag': true, 'msg': '参数传输不全'});
        return next();
    }


});

server.post("/api/workerhome/activephoto/setzan", function (req, res, next) {
    var body = {};
    if (typeof(req.body) == "string") {
        // console.log("init");
        body = JSON.parse(req.body.toString());

    } else if (typeof(req.body) == "object") {
        body = req.body;

    }
    if (body.activeId && body.activePhotoId && body.userId && body.bumenId) {
        body.dtype = "3";
        isZan(body, function (flag) {
            // console.log(flag);
            if (flag == false) {
                setFollower(body);
                var zan = {};
                zan.user_id = body.userId;
                zan.entity_id = body.activePhotoId;
                zan.dianzan_type = "3"; //设为活动点赞
                zan.create_date = new Date();
                // var req
                mysql_pool.acquire(function (err, connection) {
                    connection.query('INSERT INTO dianzan SET ?', [zan], function (err, result) {
                        if (err) {
                            console.log(err);
                            mysql_pool.release(connection);
                            res.send({'flag': false, 'msg': err});
                            return next();

                        } else {
                            mysql_pool.release(connection);
                            var score = {};
                            score.userId = body.userId;
                            score.bumenId = body.bumenId;
                            score.activeId = body.activeId;
                            score.hdType = "h_dian_zan";

                            addScore(score, function (flag, result) {

                                //空
                            });
                            body.content = "赞了你的照片";
                            tuiSong(body);
                            res.send({'flag': true, 'msg': '操作成功'});
                            return next();
                        }
                    });

                });
            } else {
                res.send({'flag': false, 'msg': '该用户已经点过赞'});
                return next();
            }
        });
    } else {
        res.send({'flag': true, 'msg': '参数不全'});
        return next();
    }

});

server.get("/api/workerhome/activephoto/iszan/:uid/:eid", function (req, res, next) {
    var body = {};
    body.userId = req.params.uid;
    body.activePhotoId = req.params.eid;
    body.dtype = "3"
    isZan(body, function (flag) {
        if (flag == true) {
            res.send({'flag': flag, 'msg': '已经点赞'});
            return next();

        } else {
            res.send({'flag': flag, 'msg': '未点赞'});
            return next();

        }
    });

});

function addScore(body, callback) {
    if (callback && typeof (callback) == "function") {
        redis_pool.acquire(function (err, client) {
            if (err) {
                callback(false, "操作失败", result);
                redis_pool.release(client);
            }
            var option = {};
            option.userId = body.userId;
            option.hdType = body.hdType;
            option.activeId = body.activeId;

            // console.log(new Date());
            option.time = new Date().getTime();
            option.bumenId = body.bumenId;
            client.sadd("score_option", JSON.stringify(option));
            redis_pool.release(client);
            callback(true, "操作成功", option);

        });
    }
}

function isSign(body, callback) {
    if (callback && typeof (callback) == "function") {
        mysql_pool.acquire(function (err, connection) {
            connection.query('SELECT count(s.id) as count FROM worker_home.sign as s where s.active_id = ? and user_id =?;', [body.activeId, body.userId], function (err, rows, fields) {
                if (err) {
                    console.log(err);
                    mysql_pool.release(connection);
                    callback(false);
                } else {
                    mysql_pool.release(connection);
                    if (rows[0].count > 0) {
                        callback(true);
                    } else {
                        callback(false);
                    }

                }
            });

        });

    }

}

function isZan(body, callback) {
    if (callback && typeof (callback) == "function") {
        mysql_pool.acquire(function (err, connection) {
            // console.log(req.params);
            connection.query('SELECT count(d.id) as count FROM dianzan as d WHERE d.user_id = ? and d.entity_id = ? and d.dianzan_type = ? ', [body.userId, body.activePhotoId, body.dtype], function (err, rows, fields) {
                if (err) {
                    console.log(err);
                    mysql_pool.release(connection);
                    callback(false);

                } else {
                    mysql_pool.release(connection);
                    if (rows[0].count > 0) {
                        callback(true);
                    } else {
                        callback(false);
                    }

                }

            });
        });
    }
}
function setFollower(body) {
    isFollower(body, function (flag) {
        if (!flag) {
            mysql_pool.acquire(function (err, connection) {
                var photo_follower = {};
                photo_follower.active_photo_id = body.activePhotoId;
                photo_follower.user_id = body.userId;
                connection.query('INSERT INTO photo_followers SET ?', [photo_follower], function (err, result) {
                    mysql_pool.release(connection);
                });

            });


        }
    });
}


//判断是否关注过活动图片
function isFollower(body, callback) {
    if (callback && typeof (callback) == "function") {
        mysql_pool.acquire(function (err, connection) {
            // console.log(req.params);
            connection.query('SELECT count(*) as count FROM photo_followers as f WHERE f.user_id = ? and f.active_photo_id = ? ', [body.userId, body.activePhotoId], function (err, rows, fields) {
                if (err) {
                    console.log(err);
                    mysql_pool.release(connection);
                    callback(false);

                } else {
                    mysql_pool.release(connection);
                    if (rows[0].count > 0) {
                        callback(true);
                    } else {
                        callback(false);
                    }

                }

            });
        });
    }
}

function selectFollower(body, callback) {
    if (callback && typeof (callback) == "function") {
        if(body.isPrivate && body.isPrivate == 1){
            mysql_pool.acquire(function (err, connection) {
                connection.query('select pf.user_id from photo_followers pf LEFT JOIN work_user u on pf.user_id = u.user_id LEFT JOIN bumen b on b.id = u.bumen_id where pf.active_photo_id = ? and b.id = ? ' , [body.activePhotoId,body.bumenId], function (err, rows, fields) {
                    if (err) {
                        console.log(err);
                        mysql_pool.release(connection);
                        callback([]);

                    } else {
                        mysql_pool.release(connection);
                        var userIds = [];
                        for (var i = 0; i < rows.length; i++) {
                            if (rows[i].user_id != body.userId) {
                                userIds.push(rows[i]);
                            }
                        }
                        // console.log(userIds);
                        callback(userIds);

                    }
                });
            });

        }else {
            mysql_pool.acquire(function (err, connection) {
                connection.query('SELECT user_id  FROM photo_followers as f WHERE f.active_photo_id = ? ', [body.activePhotoId], function (err, rows, fields) {
                    if (err) {
                        console.log(err);
                        mysql_pool.release(connection);
                        callback([]);

                    } else {
                        mysql_pool.release(connection);
                        var userIds = [];
                        for (var i = 0; i < rows.length; i++) {
                            if (rows[i].user_id != body.userId) {
                                userIds.push(rows[i]);
                            }
                        }
                        // console.log(userIds);
                        callback(userIds);

                    }
                });
            });
        }
    }
}

function tuiSong(body) {
    console.log(body);
    selectFollower(body, function (userIds) {
        var req_body = {};
        req_body.userIds = userIds;
        req_body.content = body.content;
        req_body.userId = body.userId;
        req_body.activePhotoId = body.activePhotoId;
        insertNotice(req_body, function () {
            rest_client2.post("/notice/send", req_body, function (err2, req, res, product) {
                if (err2) {
                    console.log("An error ocurred >>>>>>");
                    console.log(err2);
                }
                else {

                    console.log('推动 成功 >>>>>>>');
                }


            });
        })
    });


}

function insertNotice(body, callback) {
    var userIds = body.userIds;
    // console.log(userIds);
    for (var i = 0; i < userIds.length; i++) {
        var notice = {};
        notice.entity_id = body.activePhotoId;
        notice.notice_type = "3";
        notice.content = body.content;
        notice.sender_id = body.userId;
        notice.receiver_id = body.userIds[i].user_id;
        notice.create_date = new Date();
        notice.status = "0";
        mysql_pool.acquire(function (err, connection) {
            connection.query('INSERT INTO notice_info SET ?', [notice], function (err, result) {
                if (err) {
                    console.log(err);
                    mysql_pool.release(connection);
                } else {
                    mysql_pool.release(connection);

                }
            });
        });

    }
    callback();

}

// 启动定时器
var job = new CronJob('00 05 21 * * 1-7', function () {
        // Runs every weekday (Monday through Friday)
        // at 11:30:00 AM. It does not run on Saturday
        // or Sunday.
        postScoreOpthons();
    }, function () {
        // This function is executed when the job stops
    },
    true /* Start the job right now */,
    'Asia/Shanghai' /* Time zone of this job. */
);

/* 提交所有积分操作并删除 */
function postScoreOpthons() {
    console.log("－－－" + " 开始提交积分信息 " + "－－－");
    redis_pool.acquire(function (err, client) {
        client.smembers("score_option", function (err, options) {
            // console.log(options);
            options = changeAllJson(options, function (data) {
                rest_client.post("/api/score/jifen//active", data, function (err2, req, res, product) {
                    if (err2) {
                        console.log("An error ocurred >>>>>>");
                        console.log(err2);
                        redis_pool.release(client);
                    } else {
                        console.log('Product saved >>>>>>>');
                        client.del("score_option", function () {
                            redis_pool.release(client);
                            console.log("del");
                        });
                        // console.log(product);
                    }

                });

            });
            // console.log(options);


        });
        redis_pool.release(client);
    });


}

function changeAllJson(array, callback) {
    if (callback && typeof (callback) == "function") {
        var res = [];
        for (var i = 0; i < array.length; i++) {
            res.push(JSON.parse(array[i]));

        }
        callback(res);
    }
}
// postScoreOpthons();
function listen(port) {
    server.listen(3000, function () {
        console.log('%s listening at %s', server.name, server.url);
    });
}

server.listen(3000, function () {
    console.log('%s listening at %s', server.name, server.url);
});
exports.listen = listen;

