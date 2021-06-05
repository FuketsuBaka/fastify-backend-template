const mod_auth = require('./modules/auth_main')
const mod_db = require('./modules/db_main')
const opts = (app) => ({
    common: {
        check_auth: {
            preValidation: [app.authenticate],
        },
        check_auth_admin: {
            preValidation: [app.authenticate_admin],
        },
        check_auth_root: {
            preValidation: [app.authenticate_root],
        },
        post_method: {
            preValidation: [app.authenticate],
        },
        get_method: {
            preValidation: [app.authenticate],
        },
    },
    GET: {
        qs_auth: {
            preValidation: [app.authenticate],
            schema: {
                querystring: {
                    date_from: {type: 'string'},  // date in format (2021-02-28T00:00:00)
                    date_to: {type: 'string'},    // date in format (2021-02-28T00:00:00)
                },
            },
        },
    },
    POST: {
        auth: {
            preValidation: [app.authenticate],
        },
        auth_admin: {
            preValidation: [app.authenticate_admin],
        }
    },
})

async function routes (app) {
    app.get('/', opts(app).common.check_auth, async () => {
        return 'it works!';
    });
    // ---------------------------------------------------------------------------------------------------
    // AUTH queries
    app.post('/api/auth/login', async(req, rep) => {
        return await mod_auth.login(req, rep);
    });
    app.post('/api/auth/password', opts(app).common.check_auth, async(req) => {
        return await mod_auth.change_password(req);
    });
    app.post('/api/auth/verify', opts(app).common.check_auth, async(req) => {
        return await mod_auth.validate(req);
    });
    // AUTH service
    app.post('/api/auth/svc/init', opts(app).common.check_auth_root, async(req) => {
        let force = false;
        if (typeof req.query === 'object')
            if ('force' in req.query)
                force = true
        return await mod_auth.scripts.init(force);
    });
    app.post('/api/auth/svc/userslist', opts(app).common.check_auth_admin, async(req, rep) => {
        return await mod_auth.scripts.list_users(req, rep);
    });
    app.post('/api/auth/svc/roleslist', opts(app).common.check_auth_admin, async(req, rep) => {
        return await mod_auth.scripts.list_roles(req, rep);
    });
    app.post('/api/auth/svc/users', opts(app).common.check_auth_root, async(req, rep) => {
        return await mod_auth.scripts.users(req, rep);
    });
    app.post('/api/auth/svc/roles', opts(app).common.check_auth_root, async(req, rep) => {
        return await mod_auth.scripts.roles(req, rep);
    });
    // ---------------------------------------------------------------------------------------------------
    // SAMPLE Manual DB queries
    app.get('/api/v0/dict-sample', opts(app).common.check_auth, async(req) => {
        return await mod_db.v0.dict_sample(req);
    });
    app.get('/api/v0/dict-sample-recordset', opts(app).common.check_auth, async(req) => {
        return await mod_db.v0.dict_sample_recordset(req);
    });
}

module.exports = routes;