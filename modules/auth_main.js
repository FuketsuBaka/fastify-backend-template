const auth_utils = require('./auth_utils');
const SQR = require('./auth_sqr');

async function auth_login(req, rep) {
    try {
        if (!req.body) {
            throw new Error('Ошибка: не указано имя пользователя или пароль!');
        }
        const payload = req.body.payload;
        if (payload.username && payload.password) {
            const response = await SQR.operations.auth_login(payload.username, payload.password)
            if (response) {
                return response;
            } else {
                rep.statusCode = 404;
                rep.errorMessage = 'Ошибка: неверное имя пользователя или пароль!';
                return 'Ошибка: неверное имя пользователя или пароль!';
            }
        } else {
            throw new Error('Ошибка: не указано имя пользователя или пароль!');
        }
    } catch (e) {
        rep.statusCode = 400;
        rep.errorMessage = e;
        return e;
    }
}

async function auth_logout(req, rep) {

}

async function auth_validate(req) {
    let response = {
        id: null,
        valid: false,
        username: '',
        name: '',
        roles: [],
        is_admin: false,
    };
    let token_data = await auth_utils.JWT.destruct_token(req);
    if (token_data) {
        if (token_data.id) {
            response = await SQR.operations.user_info(token_data.id);
        }
    }
    return response;
}

async function auth_change_password(req) {
    let response = {
        success: false,
        message: 'Новый пароль не установлен!',
    };
    const payload = req.body.payload;
    let token_data = await auth_utils.JWT.destruct_token(req);
    if (token_data) {
        if (token_data.id) {
            const payload_edit = {
                id: token_data.id,
                password_old: payload.password_old,
                password_new: payload.password_new,
            }
            try {
                await SQR.scripts.users('PASSWORD', payload_edit);
                response.success = true;
                response.message = 'Пароль изменен!';
            } catch(err) {
                response.message = err.message;
            }
        }
    }
    return response;
}

async function list_users(req, rep) {
    try {
        const result = await SQR.scripts.list_users();
        return result;
    } catch (e) {
        rep.statusCode = 400;
        rep.errorMessage = e;
        return e;
    }
}

async function list_roles(req, rep) {
    try {
        const result = await SQR.scripts.list_roles();
        return result;
    } catch (e) {
        rep.statusCode = 400;
        rep.errorMessage = JSONe;
        return e;
    }
}

async function edit_users(req, rep) {
    try {
        if (!req.body) { throw new Error('Bad request: Body invalid.'); }
        if (!req.body.method || !req.body.payload) { throw new Error('Bad request: Body invalid.'); }
        const method = req.body.method;
        const payload = req.body.payload;
        const result = await SQR.scripts.users(method, payload);
        // sanitize
        if (!req.user.is_admin)
            if (result['password'])
                result.password = '****';
        return result;
    } catch (e) {
        rep.statusCode = 400;
        rep.errorMessage = e;
        return e;
    }
}

async function edit_roles(req, rep) {
    try {
        if (!req.body) { throw new Error('Bad request: Body invalid.'); }
        if (!req.body.method || !req.body.payload) { throw new Error('Bad request: Body invalid.'); }
        const method = req.body.method;
        const payload = req.body.payload;
        const result = await SQR.scripts.roles(method, payload);
        return result;
    } catch (e) {
        rep.statusCode = 400;
        rep.errorMessage = e;
        return e;
    }
}

module.exports = {
    'login': (req, rep) => auth_login(req, rep),
    'logout': (req, rep) => auth_logout(req, rep),
    'validate': (req) => auth_validate(req),
    'change_password': (req) => auth_change_password(req),
    'scripts': {
        'init': (force) => SQR.scripts.sync_db(force),
        'list_users': (req, rep) => list_users(req, rep),
        'list_roles': (req, rep) => list_roles(req, rep),
        'users': (req, rep) => edit_users(req, rep),
        'roles': (req, rep) => edit_roles(req, rep),
    },
}