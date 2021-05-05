const mssql = require('mssql');
const { Pool } = require('pg');
const mariadb = require('mariadb');
const lib = require('./db_queries');
const utils = require('../resources/utils');
const conf = require('../resources/config');
const mod_cache = require('./cache');

// You may need this
const moment = require('moment');
const _ = require('lodash');


let ms_pool, pg_pool, mdb_pool;

async function init_pools() {
    if (conf.DB.use.includes('MSSQL')) {
        ms_pool = new mssql.ConnectionPool(conf.DB.MSSQL);
        // MSSQL driver allows to init connection beforehand, get a pool and work with it
        await ms_pool.connect(err => {
            utils.debug(`Connection to MS-SQL: ${err ? err : 'success'}`);
        })
    }
    if (conf.DB.use.includes('postgres'))
        pg_pool = new Pool(conf.DB.postgres);
    if (conf.DB.use.includes('mariadb'))
        mdb_pool = mariadb.createPool(conf.DB.mariadb);
    // Postgres pool allows singlequery
    // MDB returns promises with connection-object
    utils.debug(`Init connection-pools: complete`);
}

// -------------------------------------------------------
function perform_query_resolve(query_str, driver) {
    utils.debug(`
--------------------------------------------------------------
${query_str}
--------------------------------------------------------------`, null, 'info', 'queries')
    return new Promise(function (resolve, reject) {
        let payload = {
            'ERROR_CODE': 0,
            'ERROR_DESC': null,
            'DATA': null,
        };
        switch(driver) {
            case 'mssql': {
                if (!ms_pool.connected) {
                    payload.ERROR_CODE = 1;
                    payload.ERROR_DESC = 'No connection';
                    payload.DATA = null;
                    resolve(payload);
                }
                ms_pool.request().query(query_str, (err, query_res) => {
                    if (err) {
                        utils.debug(`${err.code}: ${err.message}`)
                        payload.ERROR_CODE = 1;
                        payload.ERROR_DESC = `${err.code}: ${err.message}`;
                        payload.DATA = null;
                        resolve(payload);
                    }
                    if (query_res) {
                        if (query_res.recordsets && Array.isArray(query_res.rowsAffected)) {
                            // Result may be Array of recordsets
                            let payload_DATA = query_res.recordsets.map((recordset) => {
                                return {rows_total: recordset.length, rows: recordset}
                            })
                            if (_.sumBy(payload_DATA, 'rows_total') === 0) {
                                payload.ERROR_CODE = 2;
                                payload.ERROR_DESC = 'No records found';
                                payload.DATA = null;
                            } else {
                                payload.ERROR_CODE = 0;
                                payload.ERROR_DESC = null;
                                payload.DATA = payload_DATA;
                            }
                        } else {
                            payload.ERROR_CODE = 2;
                            payload.ERROR_DESC = 'No records found';
                            payload.DATA = null;
                        }
                    } else {
                        payload.ERROR_CODE = 1;
                        payload.ERROR_DESC = 'Request failed';
                        payload.DATA = null;
                    }
                    resolve(payload);
                });
                break;
            }
            case 'pg': {
                pg_pool.connect().then(pg_conn => {
                    pg_conn.query(query_str, (err, res) => {
                        pg_conn.release();
                        if (err) {
                            utils.debug(err)
                            payload.ERROR_CODE = 1;
                            payload.ERROR_DESC = err;
                            payload.DATA = null;
                            resolve(payload);
                        }
                        if (res) {
                            if (res.rowAsArray === true) {
                                let payload_DATA = query_res.rows.map((recordset) => {
                                    return {rows_total: recordset.length, rows: recordset}
                                })
                                if (_.sumBy(payload_DATA, 'rows_total') === 0) {
                                    payload.ERROR_CODE = 2;
                                    payload.ERROR_DESC = 'No records found';
                                    payload.DATA = null;
                                } else {
                                    payload.ERROR_CODE = 0;
                                    payload.ERROR_DESC = null;
                                    payload.DATA = payload_DATA;
                                }
                            } else {
                                if (res.rowCount === 0) {
                                    payload.ERROR_CODE = 2;
                                    payload.ERROR_DESC = 'No records found';
                                    payload.DATA = null;
                                } else {
                                    payload.ERROR_CODE = 0;
                                    payload.ERROR_DESC = null;
                                    payload.DATA = [{
                                        rows_total: res.rowCount,
                                        rows: res.rows,
                                    }];
                                }
                            }
                        } else {
                            payload.ERROR_CODE = 1;
                            payload.ERROR_DESC = 'Request failed';
                            payload.DATA = null;
                        }
                        resolve(payload);
                    });
                })
                break;
            }
            case 'mdb': {
                mdb_pool.getConnection().then(conn => {
                    conn.query(query_str).then((rows) => {
                        if (Array.isArray(rows)) {
                            let payload_DATA = [];
                            if (rows.meta) {
                                payload_DATA = [{rows_total: rows.length, rows: rows}];
                            } else {
                                payload_DATA = rows.map((recordset) => {
                                    return {rows_total: recordset.length, rows: recordset}
                                })
                            }
                            if (_.sumBy(payload_DATA, 'rows_total') === 0) {
                                payload.ERROR_CODE = 2;
                                payload.ERROR_DESC = 'No records found';
                                payload.DATA = null;
                            } else {
                                payload.ERROR_CODE = 0;
                                payload.ERROR_DESC = null;
                                payload.DATA = payload_DATA;
                            }
                        } else {
                            payload.ERROR_CODE = 2;
                            payload.ERROR_DESC = 'No records found';
                            payload.DATA = null;
                        }
                        conn.end();
                        resolve(payload);
                    }).catch(err => {
                        conn.end();
                        utils.debug(err);
                        payload.ERROR_CODE = 1;
                        payload.ERROR_DESC = err;
                        payload.DATA = null;
                        resolve(payload);
                    })
                }).catch(err => {
                    utils.debug(err);
                    payload.ERROR_CODE = 1;
                    payload.ERROR_DESC = err;
                    payload.DATA = null;
                    resolve(payload);
                });
                break;
            }
            default: {
                utils.debug(`Driver: ${driver} has no query operator`)
                reject(`Driver: ${driver} has no query operator`);
            }
        }
    })
}

// -------------------------------------------------------
// QUERIES
let query_dict_sample_v0 = async function query_dict_sample_v0(req) {
    utils.debug(`Query Dict Sample V0`)
    const RES_filters = {
        FINALLY: ``
    };
    const query_str = lib.v0.dict_sample(RES_filters);
    return perform_query_resolve(query_str, 'mdb');
}
query_dict_sample_v0 = mod_cache.cached(query_dict_sample_v0)

async function query_dict_sample_recordset_v0(req) {
    utils.debug(`Query Dict Sample (Recordset) V0`)

    const RES_filters = {
        FINALLY: ``
    };
    const query_str = lib.v0.dict_sample_recordset(RES_filters);
    return perform_query_resolve(query_str, 'mdb');
}


module.exports = {
    utils: {
        'init_pools': () => init_pools(),
        'update_cache': (type) => update_cache(type),
    },
    v0: {
        'dict_sample': (req) => query_dict_sample_v0(req),
        'dict_sample_recordset': (req) => query_dict_sample_recordset_v0(req),
    }
}