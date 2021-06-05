const conf = require('../resources/config');
const auth_utils = require('./auth_utils');
const utils = require('../resources/utils');
const { Sequelize, Model, DataTypes } = require('sequelize');
const _ = require('lodash');

const db_connection = new Sequelize(conf.DB.postgres.database,
    conf.DB.postgres.user,
    conf.DB.postgres.password, {
        host: conf.DB.postgres.host,
        port: conf.DB.postgres.port,
        dialect: 'postgres',
        logging: false,
    }
);

class User extends Model {}
User.init({
    id: { type: DataTypes.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true, },
    username: { type: DataTypes.STRING, allowNull: false, unique: true, },
    name: {
        type: DataTypes.STRING, allowNull: false,
        set(newValue) {
            if (newValue === '') {
                let username_value = this.getDataValue('username');
                if (!username_value) throw new Error('Username required');
                this.setDataValue('name', username_value);
            } else {
                this.setDataValue('name', newValue);
            }
        }
    },
    password: {
        type: DataTypes.TEXT, allowNull: false,
        get() {
            const rawValue = this.getDataValue('password');
            return rawValue ? auth_utils.JWT.decrypt(rawValue) : null;
            //return rawValue ? '**crypted**' : null;
        },
        set(newValue) {
            this.setDataValue('password', auth_utils.JWT.encrypt(newValue));
        }
    },
    is_admin: {
        type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false,
    },
    view: {
        type: DataTypes.VIRTUAL,
        get() {
            return `${this.name} (${this.username})`;
        },
        set(newValue) {throw new Error('`view` is virtual field');}
    }
}, {
    timestamps: true,
    tableName: 'users',
    schema: 'auth',
    freezeTableName: true,
    defaultScope: {
        attributes: {
            exclude: ['password']
        },
    },
    scopes: {
        safe: {
        },
    },
    sequelize: db_connection,
    modelName: 'User',
});

class Role extends Model {}
Role.init({
    id: { type: DataTypes.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true, },
    name: {
        type: DataTypes.STRING, allowNull: false,
        set(newValue) {
            if (newValue === '') {
                let slug_value = this.getDataValue('slug');
                if (!slug_value) throw new Error('Slug or Name required');
                this.setDataValue('name', slug_value);
            } else {
                this.setDataValue('name', newValue);
            }
        }
    },
    slug: {
        type: DataTypes.STRING, allowNull: false, unique: true,
    },
    view: {
        type: DataTypes.VIRTUAL,
        get() {
            return `${this.name} (${this.slug})`;
        },
        set(newValue) {throw new Error('`view` is virtual field');}
    }
}, {
    sequelize: db_connection,
    timestamps: false,
    tableName: 'roles',
    schema: 'auth',
    freezeTableName: true,
    modelName: 'Role',
});

User.belongsToMany(Role, {through: 'UserRoles' })
Role.belongsToMany(User, {through: 'UserRoles' })

// ----------------------------------------
// -------------- OPERATIONS --------------

async function sync_db(force) {
    if (force) {
        await db_connection.sync({force: true})
    } else {
        await db_connection.sync({alter: true})
    }
    if (force) {
        utils.debug(`AUTH Force init:`)
        // init first users and groups
        await edit_users('ADD', {
            username: 'su',
            password: conf.APP.ROOT_PASSWORD,
            name: 'Root',
            is_admin: true,
        });
        utils.debug(`--- User: 'su' created`)
        await edit_users('ADD', {
            username: 'admin',
            password: 'admin',
            name: 'Администратор',
        });
        utils.debug(`--- User: 'admin' with password 'admin' created`)
        await edit_roles('ADD', {
            slug: 'admins',
            name: 'Администраторы'
        })
        utils.debug(`--- Group: 'admins' created`)
        await edit_users('ASSIGN', {
            username: 'admin',
            roles: 'admins'
        })
        utils.debug(`--- User 'admin' assigned to group 'admins'`)
    }
    return { status: 'ok', message: 'Sync done'};
}

async function query_user_password(username, password) {
    const user = await User.scope('safe').findOne({
        where: {
            username: username,
        }
    });
    let response = {
        'success': false,
        'message': 'Ошибка: неверное имя пользователя или пароль!',
        'token': null,
    };
    if (user) {
        console.log(user.password);
        if (user.password === password) {
            response.success = true;
            response.message = 'Вход выполнен';
            response.token = auth_utils.JWT.construct_token(user);
        }
    }
    return response;
}

async function get_user_info(userId) {
    const obj = {
        id: null,
        valid: false,
        username: '',
        name: '',
        roles: [],
        is_admin: false,
    };
    const user = await User.findByPk(userId, {
        include: {
            model: Role,
            through: {
                attributes: [],
            },
        }
    });
    if (user) {
        obj.id = user.id;
        obj.valid = true;
        obj.username = user.username;
        obj.name = user.name;
        obj.roles = _.map(user.Roles, function(r) { return {name: r.name, slug: r.slug}});
        obj.is_admin = user.is_admin;
        return obj;
    }
    return obj;
}

async function list_users() {
    const users = User.findAll({
        include: {
            model: Role,
            through: {
                attributes: [],
            },
        }
    });
    if (users) return users;
    return [];
}

async function list_roles() {
    const roles = Role.findAll({
        include: {
            model: User,
            through: {
                attributes: []
            },
        }
    });
    if (roles) return roles;
    return [];
}

async function edit_users(method, payload) {
    if (method === 'ADD') {
        let vals = {
            username: payload.username,
            password: payload.password,
            name: '',
        }
        if('is_admin' in payload)
            vals.is_admin = payload.is_admin === true;
        if(payload.name)
            vals.name = payload.name;

        return await User.create(vals);
    }
    if (method === 'EDIT') {
        let search_filter = {};
        if (payload.id)         search_filter['id'] = payload.id;
        if (payload.username)   search_filter['username'] = payload.username;
        if (payload.name)       search_filter['name'] = payload.name;
        if (search_filter === {}) throw new Error('Bad request: Search filters required!')

        const changes = payload.changes;
        if (!changes) throw new Error('Bad request: No changes provided!')

        const user = await User.findOne({where: search_filter})
        if (!user) throw new Error('Bad request: User by this filters not found!')

        Object.keys(changes).forEach((key) => {
            user[key] = changes[key];
        });
        return await user.save();
    }
    if (method === 'PASSWORD') {
        let search_filter = {};
        if (payload.id)         search_filter['id'] = payload.id;
        if (search_filter === {}) throw new Error('Не указаны фильтры поиска!')

        const password_old = payload.password_old;
        if (!password_old) throw new Error('Не указан текущий пароль!')
        const password_new = payload.password_new;
        if (!password_new) throw new Error('Не указан новый пароль!')

        const user = await User.scope('safe').findOne({where: search_filter})
        if (!user) throw new Error('По такому отбору пользователь не найден!')
        if(user.password !== password_old) throw new Error('Неправильный текущий пароль!')

        user.password = password_new;
        return await user.save();
    }
    if (method === 'DELETE') {
        let search_filter = {};
        if (payload.id)         search_filter['id'] = payload.id;
        if (payload.username)   search_filter['username'] = payload.username;
        if (payload.name)       search_filter['name'] = payload.name;
        if (search_filter === {}) throw new Error('Bad request: Search filters required!')

        const user = User.findOne({where: search_filter});
        if (!user) throw new Error('Bad request: User by this filters not found!')

        return await User.destroy({where: search_filter});
    }
    if (method === 'ASSIGN') {
        let search_filter = {};
        if (payload.id)         search_filter['id'] = payload.id;
        if (payload.username)   search_filter['username'] = payload.username;
        if (payload.name)       search_filter['name'] = payload.name;
        if (search_filter === {}) throw new Error('Bad request: Search filters required!')

        const roles = payload.roles;    // list of slugs or a single slug
        if (!roles && !payload['replace_all']) throw new Error('Bad request: No roles for assignment provided!')

        const user = await User.findOne({where: search_filter})
        if (!user) throw new Error('Bad request: User by this username not found!')

        const roles_db = await Role.findAll({where: {slug: roles}});
        //console.log(Object.getOwnPropertyNames(user))
        if (payload['replace_all']) {
            // Delete all roles
            const user_roles = await user.getRoles();
            if (roles_db.length > 0) {
                await user.removeRoles(user_roles);
                return await user.addRoles(roles_db);
            }
            else
                return await user.removeRoles(user_roles);
        } else {
            return await user.addRoles(roles_db);
        }
    }
    if (method === 'DESSIGN') {
        let search_filter = {};
        if (payload.id)         search_filter['id'] = payload.id;
        if (payload.username)   search_filter['username'] = payload.username;
        if (payload.name)       search_filter['name'] = payload.name;
        if (search_filter === {}) throw new Error('Bad request: Search filters required!')

        const roles = payload.roles;    // list of slugs or a single slug
        if (!roles) throw new Error('Bad request: No roles for deassignment provided!')

        const user = await User.findOne({where: search_filter})
        if (!user) throw new Error('Bad request: User by this username not found!')

        const roles_db = await Role.findAll({where: {slug: roles}});
        return await user.removeRoles(roles_db);
    }
    return null;
}

async function edit_roles(method, payload) {
    if (method === 'ADD') {
        let vals = {
            slug: payload.slug,
            name: '',
        }
        if(payload.name)
            vals.name = payload.name;
        return await Role.create(vals);
    }
    if (method === 'EDIT') {
        let search_filter = {};
        if (payload.id)         search_filter['id'] = payload.id;
        if (payload.slug)       search_filter['slug'] = payload.slug;
        if (payload.name)       search_filter['name'] = payload.name;
        if (search_filter === {}) throw new Error('Bad request: Search filters required!')

        const changes = payload.changes;
        if (!changes) throw new Error('Bad request: No changes provided!')

        const role = await Role.findOne({where: search_filter})
        if (!role) throw new Error('Bad request: Role not found!')

        Object.keys(changes).forEach((key) => {
            role[key] = changes[key];
        });
        return await role.save();
    }
    if (method === 'DELETE') {
        let search_filter = {};
        if (payload.id)         search_filter['id'] = payload.id;
        if (payload.slug)       search_filter['slug'] = payload.slug;
        if (payload.name)       search_filter['name'] = payload.name;
        if (search_filter === {}) throw new Error('Bad request: Search filters required!')

        const role = await Role.findOne({where: search_filter})
        if (!role) throw new Error('Bad request: Role not found!')

        return await Role.destroy({where: search_filter});
    }
    return null;
}

module.exports = {
    'connections': {
        db_connection: db_connection,
    },
    'models': {
        User: User,
        Role: Role,
    },
    'operations': {
        'auth_login': (username, password) => query_user_password(username, password),
        'user_info': (userId) => get_user_info(userId),
    },
    'scripts': {
        'sync_db': (force) => sync_db(force),
        'list_users': () => list_users(),
        'list_roles': () => list_roles(),
        'users': (method, payload) => edit_users(method, payload),
        'roles': (method, payload) => edit_roles(method, payload),
    }

}