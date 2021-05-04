'use strict'
// demonize with: nodemon -x "node server.js || touch server.js"
const fp = require("fastify-plugin");
const fs = require('fs');
const conf = require('./resources/config');
const utils = require('./resources/utils');
require('make-promises-safe');
const LOGGER = require('./modules/logger');
const mod_auth = require('./modules/auth_main');
const mod_db = require('./modules/db_main');

global.$app = null;
global.$LOGGER = new LOGGER('main');

// HTTPS
const app_options = {}
function init_http_options() {
    app_options.http2 = !conf.ENV_IS_DEV;
    if (app_options.http2) {
        app_options.https = {
            allowHTTP1: true,
            key: fs.readFileSync(conf.APP.SSL_KEY, 'utf8'),
            cert: fs.readFileSync(conf.APP.SSL_CERT, 'utf8'),
        }
    }
}

// Logger
app_options.logger = $LOGGER.default;

// APP
function invoke_app_instance() {
    global.$app = require('fastify')(app_options);
    $app.register(require('fastify-multipart'));
    $app.register(require('fastify-cors'));
    $app.register(require('fastify-jwt'), { secret: conf.APP.JWT_SECRET });
    $app.register(require('./route-root'));
}

function setup_app_decorators() {
    $app.decorate('authenticate', async function(request, reply) {
        try {
            const auth = request.headers.authorization;
            if (!auth) { throw(conf.ERRORS.E401) }
            if (auth !== `Bearer ${conf.APP.ROOT_TOKEN}`) {
                const res = await mod_auth.validate(request, reply)
                if (res.valid !== true) {
                    throw(conf.ERRORS.E401)
                }
            }
        } catch (err) {
            throw(err);
            // reply.send(err)
        }
    });
    $app.decorate('authenticate_admin', async function(request, reply) {
        try {
            const auth = request.headers.authorization;
            if (!auth) {
                throw(conf.ERRORS.E401)
            }
            if (auth !== `Bearer ${conf.APP.ROOT_TOKEN}`) {
                const res = await mod_auth.validate(request, reply)
                if (res.valid !== true || !(_.map(res.roles, 'slug').includes('admins') || res.is_admin === true)) {
                    throw(conf.ERRORS.E403);
                }
            }
        } catch (err) {
            throw(err);
            // reply.send(err)
        }
    });
    $app.decorate('authenticate_root', async function(request, reply) {
        try {
            const auth = request.headers.authorization;
            if (!auth) { throw(conf.ERRORS.E401) }
            if (auth !== `Bearer ${conf.APP.ROOT_TOKEN}`) {
                const res = await mod_auth.validate(request, reply)
                if (res.valid !== true || res.is_admin !== true) {
                    throw(conf.ERRORS.E403);
                }
            }
        } catch (err) {
            throw(err);
            // reply.send(err)
        }
    });
}

function setup_app_hooks() {
    // Log error
    $app.setErrorHandler(function (error, request, reply) {
        utils.debug(`
--------- ERR ---------
ERROR:     ${error instanceof Error ? error : JSON.stringify(error)}
--------- ^^^ ---------`, error instanceof Error ? error : null);
        if (error.errors) {
            if (Array.isArray(error.errors)) {
                // Sequelize errors
                error.statusCode = 400;
                error.message = error.errors[0].message;
            }
        }
        if (!error.statusCode) {
            error.statusCode = 500;
            error.message = 'Unknown error'
        }
        // Send error response
        reply.status(error.statusCode).send({
            ok: false,
            timestamp: new Date(),
            statusCode: error.statusCode,
            message: error.message,
        });
    });
    // $app.addHook('onRequest', async (req, rep) => {
    //     try {
    //         await req.jwtVerify();
    //     } catch (err) {
    //         rep.send(err);
    //     }
    // });
}
function __init__() {
    invoke_app_instance();
    init_http_options();
    setup_app_decorators();
    setup_app_hooks();
    const logs = Object.keys(conf.APP.LOGS);
    let logs_str = '';
    for (let i = 0; i < logs.length; i++) {
        logs_str += `
    ${i+1}. ${logs[i].toLowerCase()} - ${conf.APP.LOGS[logs[i]].path} [${conf.APP.LOGS[logs[i]].level}]`
    }
    const start_up_str = `Starting:
    DEV: ${conf.ENV_IS_DEV} 
    Logger: Pino
    Destinations: ${logs_str}`

    utils.debug(start_up_str);
    // DB-Init
    mod_db.utils.init_pools();
}
const __main__ = async() => {
    try {
        await $app.listen(3000, '0.0.0.0')
    } catch (err) {
        utils.debug(err);
        process.exit(1);
    }
}
__init__();
__main__();