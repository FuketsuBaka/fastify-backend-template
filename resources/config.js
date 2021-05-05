const ENV_IS_DEV = process.platform === "win32";

const app_params = {
    SSL_KEY: ENV_IS_DEV ? './data/server.key' : '/etc/ssl/private/server.key',
    SSL_CERT: ENV_IS_DEV ? './data/server.pem' : '/etc/ssl/certs/server.pem',
    JWT_SECRET: 'THbVwadEZVhgt8tALkBeBVt6gdALxCrvCM6BTnpZry4Cat5CQY38nAyxKRwNbAyJ',
    ROOT_TOKEN: 'gsWDEmKmGXpHquQmEwwReMNUXa7gpzvTepETseb9vWtZqU2RgmCCn49UgKwUPa8V',
    AES_KEY: 'aes_eS5kZmetHRTrZ94s',
    LOGS: {
        // Logger names case-insensitive
        MAIN: {
            path: `${ENV_IS_DEV ? './logs/main.log' : '/var/log/main.log'}`,
            level: `${ENV_IS_DEV ? 'info' : 'info'}`,
            rotate: true,
        },
        SUB: {
            path: `${ENV_IS_DEV ? './logs/sub.log' : '/var/log/sub.log'}`,
            level: `${ENV_IS_DEV ? 'info' : 'info'}`,
            rotate: false,
        },
        QUERIES: {
            path: `${ENV_IS_DEV ? './logs/queries.log' : '/var/log/queries.log'}`,
            level: `${ENV_IS_DEV ? 'info' : 'info'}`,
            rotate: true,
        },
    },
}

const db_credentials = {
    use: ['mariadb'],       // Specify db-credentials You gonna use.
                            // This checked on db_main.js then creating pools.
    MSSQL: {
        'user': 'username',
        'password': 'pa$$word',
        'server': '127.0.0.1',
        'port': 1433,
        'database': 'main',
        'requestTimeout': 180000,
        'options': {
            'encrypt': true,
        },
        'pool': {
            'max': 30,
            'min': 0,
            'idleTimeoutMillis': 30000
        },
    },
    postgres: {
        'user': 'username',
        'password': 'pa$$word',
        'host': '127.0.0.1',
        'port': 5637,
        'database': 'main',
    },
    mariadb: {
        'user':'myUser',
        'password': 'myPassword',
        'host': '127.0.0.1',
        'port': 3306,
        'database': 'main',
        'multipleStatements': true,
        // 'rowsAsArray': true,
        'connectTimeout': 30000,
        'connectionLimit': 30
    },
}

const error_messages = {
    'E401': {
        statusCode: 401,
        error: 'Unauthorized',
        message: 'No valid Authorization was found in request.headers'
    },
    'E403': {
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied'
    },
}

const cache_settings = {
    DATA: {
        dict_sample: {
            interval: 3600,
        },
    },
    APPLY_MAP: {
        // function-name : cache-name
        'query_dict_sample_v0': 'dict_sample',
    }
}

module.exports =  {
    ENV_IS_DEV: ENV_IS_DEV,
    APP: app_params,
    DB: db_credentials,
    CACHE: cache_settings,
    ERRORS: error_messages,
}