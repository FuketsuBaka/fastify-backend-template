const conf = require('../resources/config');
const utils = require('../resources/utils');
const crypto = require('crypto-js');

// JWT UTILS
const encrypt_with_AES = (password) => {
    return crypto.AES.encrypt(password, conf.APP.AES_KEY).toString();
}

const decrypt_with_AES = (password) => {
    const bytes = crypto.AES.decrypt(password, conf.APP.AES_KEY);
    return bytes.toString(crypto.enc.Utf8);
}

function jwt_construct_token(user) {
    const object_to_sign = {
        username: user.username,
        id: user.id,
    }
    return $app.jwt.sign(object_to_sign);
}

async function jwt_destruct_token(request) {
    const auth = request.headers.authorization;
    const token = auth.split(' ')[1]

    return new Promise(function (resolve) {
        $app.jwt.verify(token, (err, decoded) => {
            if (err) {
                utils.debug(err, err, 'error');
                resolve(null);
            }
            resolve(decoded)
        });
    });
}


module.exports = {
    'JWT': {
        'encrypt': (password) => encrypt_with_AES(password),
        'decrypt': (password) => decrypt_with_AES(password),
        'construct_token': (user) => jwt_construct_token(user),
        'destruct_token': (request) => jwt_destruct_token(request),
    },
}