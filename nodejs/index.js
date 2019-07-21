const request = require('request');
const config = require('config');
const cheerio = require('cheerio');
const async = require('async');
const sha1 = require('sha1');
const AWS = require('aws-sdk');

AWS.config.update({
    region: 'ap-northeast-2',
    endpoint: "http://dynamodb.ap-northeast-2.amazonaws.com"
});

//const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

var jar = request.jar();
var req = request.defaults({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'ko,en-US;q=0.8,en;q=0.6'
    },
    jar: jar,
    gzip: true,
    followAllRedirects: true,
    //encoding: null
});

var captchaId = '';
var saltValue = '';
var loginToken = '';

var start = function (callback) {
    callback(null, {
        data: {
            couponCount: 0,
        },
        message: "",
        loggedIn: false,
    });
};

var requestLoginPage = function (result, callback) {
    if (result.loggedIn) {
        callback(null, result);
        return;
    }

    var option = {
        uri: 'https://front.wemakeprice.com/user/login',
        method: 'GET',
        qs: {
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        console.log(`Request Login Page`);
        callback(err, result);
    });
};

var requestCaptcha = function (result, callback) {
    if (result.loggedIn) {
        callback(null, result);
        return;
    }

    //                $("#_captchaImage").attr("src", defaultUrl + userApiURL.captchaImgUrl + "?captchaId=" + getCaptchaId + "&time=" + cacheExpireTime),

    var option = {
        uri: 'https://front.wemakeprice.com/api/user/login/getCaptchaId.json',
        method: 'GET',
        json: true,
        qs: {
        },
        headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/json',
            'Referer': 'https://front.wemakeprice.com/user/login',
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        console.log("Parsing Captcha");
        console.log(JSON.stringify(body, null, 2));
        captchaId = body && body.data && body.data.captchaId;
        if (captchaId) {
            setTimeout(() => {
                callback(err, result);
            }, 1000);
        } else {
            callback("captchaId not found!", result);
        }
    });
};

var requestSalt = function (result, callback) {
    if (result.loggedIn) {
        callback(null, result);
        return;
    }

    var option = {
        uri: 'https://front.wemakeprice.com/api/user/login/salt.json',
        method: 'GET',
        json: true,
        qs: {
            _: Date.now()
        },
        headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/json',
            'Referer': 'https://front.wemakeprice.com/user/login',
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        console.log("Parsing Salt");
        console.log(JSON.stringify(body, null, 2));
        saltValue = body && body.data && body.data.salt;
        if (saltValue) {
            callback(err, result);
        } else {
            callback("saltValue not found!", result);
        }
    });
};

var requestLoginProcess = function (result, callback) {
    if (result.loggedIn) {
        callback(null, result);
        return;
    }

    var authConfig = config.get('auth');

    var lowerCasePW = authConfig.pw.toLowerCase();
    var loginSalts = saltValue.substr(1, 1) + saltValue.substr(4, 1) + saltValue.substr(8, 1) + saltValue.substr(12, 1);
    var encryptValue = sha1(loginSalts + sha1(lowerCasePW)) + loginSalts;

    var option = {
        uri: 'https://front.wemakeprice.com/api/edge/login.json',
        method: 'POST',
        json: true,
        body: {
            captcha: "",
            captchaId: captchaId,
            selectionYn: "Y",
            userId: authConfig.id,
            userPassword: encryptValue
        },
        headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/json',
            'Referer': 'https://front.wemakeprice.com/user/login',
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        console.log("Parsing Login Result");
        console.log(JSON.stringify(body, null, 2));
        loginToken = body && body.data && body.data.loginToken;
        if (loginToken) {
            result.loggedIn = true;
            console.log(JSON.stringify(jar, null, 2));
            callback(err, result);
        } else {
            result.loggedIn = false;
            console.log("Login failed!");
            callback(err, result);
        }
    });
};

var requestLoginCheck = function (result, callback) {
    var option = {
        uri: 'https://front.wemakeprice.com/main',
        method: 'GET',
        qs: {
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        console.log("Checking Login Result");
        if (!err && body.indexOf("_logOutBtn") < 0) {
            result.loggedIn = false;
            console.log("Login failed!");
            callback(err, result);
        } else {
            result.loggedIn = true;
            callback(err, result);
        }
    });
};

var requestCouponPage = function (result, callback) {
    if (!result.loggedIn) {
        callback(null, result);
        return;
    }

    var option = {
        uri: 'https://front.wemakeprice.com/mypage/coupon',
        method: 'GET',
        qs: {
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        console.log("Parsing Coupon Count");
        if (!err) {
            var $ = cheerio.load(body);
            result.data.couponCount = parseInt($('div.my_detail_box.on > dl > dd:nth-child(6) > a > em').text(), 10);
            console.log("Coupon Count:", result.data.couponCount);
        }

        callback(err, result);
    });
};

var makeReport = function (result, callback) {
    var queryParams = {
        TableName: 'webdata',
        KeyConditionExpression: "#site = :site",
        ScanIndexForward: false,
        Limit: 1,
        ExpressionAttributeNames: {
            "#site": "site",
        },
        ExpressionAttributeValues: {
            ":site": 'wemakeprice-coupon',
        }
    };

    console.log("Making Report");
    docClient.query(queryParams, (err, res) => {
        if (!err) {
            if (res.Items.length > 0 && res.Items[0].data) {
                var saved = res.Items[0].data;
                if (saved.couponCount !== result.data.couponCount) {
                    result.message += `계정 쿠폰 갯수 변경: ${result.data.couponCount}\n`;
                }
            }
        }
        callback(err, result);
    });
};

var saveReport = function (result, callback) {
    var putParams = {
        TableName: 'webdata',
        Item: {
            site: 'wemakeprice-coupon',
            timestamp: Date.now(),
            data: result.data
        }
    };

    console.log("Saving Report");
    docClient.put(putParams, (err, res) => {
        if (!err) {
            console.log(JSON.stringify(res));
        }
        callback(err, result);
    });
};

var notifyReport = function (result, callback) {
    if (result.message.length > 0) {
        var telegramConfig = config.get('telegram');
        var option = {
            uri: `https://api.telegram.org/${telegramConfig.bot_id}:${telegramConfig.token}/sendMessage`,
            method: 'POST',
            json: true,
            body: {
                'chat_id': telegramConfig.chat_id,
                'text': result.message
            }
        };

        req(option, function (err, response, body) {
            if (!err && (body && !body.ok)) {
                console.log(body);
                callback("Send Message Fail", result);
            } else {
                callback(err, result);
            }
        });
    } else {
        callback(null, result);
    }
};

exports.handler = function (event, context, callback) {
    async.waterfall([
        start,
        requestLoginCheck,
        requestLoginPage,
        requestCaptcha,
        requestSalt,
        requestLoginProcess,
        requestLoginCheck,
        requestCouponPage,
        makeReport,
        saveReport,
        notifyReport,
    ], function (err, result) {
        if (err) {
            console.log(err);
        }
    });

    if (callback) {
        callback(null, 'Success');
    }
};
