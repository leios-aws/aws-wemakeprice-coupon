const request = require('request');
const config = require('config');
const cheerio = require('cheerio');
const async = require('async');
const sha1 = require('sha1');
const AWS = require('aws-sdk');
const fs = require('fs');

AWS.config.update({
    region: 'ap-northeast-2',
    endpoint: "http://dynamodb.ap-northeast-2.amazonaws.com"
});

//const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

var jar;
var req;

var captchaId = '';
var saltValue = '';
var loginToken = '';

var start = function (callback) {
    req = request.defaults({
        headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'ko,en-US;q=0.8,en;q=0.6'
        },
        jar: true,
        gzip: true,
        followAllRedirects: true,
        //encoding: null
    });

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
        uri: 'https://mw.wemakeprice.com/user/login',
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
        uri: 'https://mw.wemakeprice.com/api/user/login/getCaptchaId.json',
        method: 'GET',
        json: true,
        qs: {
        },
        headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/json',
            'Referer': 'https://mw.wemakeprice.com/user/login',
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
        uri: 'https://mw.wemakeprice.com/api/user/login/salt.json',
        method: 'GET',
        json: true,
        qs: {
            _: Date.now()
        },
        headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/json',
            'Referer': 'https://mw.wemakeprice.com/user/login',
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
        uri: 'https://mw.wemakeprice.com/api/edge/login.json',
        method: 'POST',
        json: true,
        body: {
            autoLogin: 1,
            captcha: "",
            captchaId: captchaId,
            userId: authConfig.id,
            userPassword: encryptValue
        },
        headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/json',
            'Referer': 'https://mw.wemakeprice.com/user/login',
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
            callback(err, result);
        } else {
            result.loggedIn = false;
            console.log("Login failed!");
            callback(err, result);
        }
    });
};

var requestCouponPage = function (result, callback) {
    var option = {
        uri: 'https://mw.wemakeprice.com/mypage',
        method: 'GET',
        qs: {
        }
    };

    req(option, function (err, response, body) {
        result.response = response;
        result.body = body;

        console.log("Parsing Coupon Count");
        if (!err) {
            if (body.indexOf('ico_mypage_logout.png') < 0) {
                result.loggedIn = false;
                console.log("Login failed!");
            } else {
                var $ = cheerio.load(body);
                result.data.couponCount = parseInt($('div.total_mypage > dl:nth-child(2) > dd > a > em:nth-child(1)').text(), 10);
                console.log("Coupon Count:", result.data.couponCount);

                // http://m.wemakeprice.com/m/mypage/saleCoupon_getList_json/usable

                // https://mw.wemakeprice.com/mypage/coupon
                // div.sale_coupon_wrap > div.coupon_list > ul
            }
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
            timestamp: Math.floor(Date.now() / 1000),
            ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
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
        requestCouponPage,
        requestLoginPage,
        requestCaptcha,
        requestSalt,
        requestLoginProcess,
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
