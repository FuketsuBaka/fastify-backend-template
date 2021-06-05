const conf = require('../resources/config');
const utils = require('../resources/utils');
const moment = require('moment');
const _ = require('lodash');

const cached_data = {}

function init_cached_data() {
    Object.keys(conf.CACHE.DATA).forEach(key => {
        cached_data[key] = {
            last_updated: null,
            interval: conf.CACHE.DATA[key].interval,
            data: null
        }
    })
    utils.debug('Init cached data: complete');
}

const cached = function(fn) {
    return async function(...args) {
        console.log(fn.name)
        if (arguments.length === 0)
            return await fn(...args);

        const cache_key = conf.CACHE.APPLY_MAP[fn.name];
        if (!cache_key)
            return await fn(...args);

        if (cache_key in cached_data) {
            if (has_cache(cache_key)) {
                utils.debug(`${cache_key} - Return cached data`)
                return cached_data[cache_key].data;
            }
            cached_data[cache_key].data = await fn(...args);
            if (cached_data[cache_key].data.ERROR_CODE === 0) {
                utils.debug(`${cache_key} - Cache updated`)
                cached_data[cache_key].last_updated = moment();
            } else {
                // drop
                utils.debug(`${cache_key} - Cache dropped`)
                cached_data[cache_key].data = null;
            }
            return cached_data[cache_key].data;
        } else {
            // not caching this
            return await fn(...args);
        }
    }
}

function has_cache(type) {
    return cached_data[type].data
        && moment(cached_data[type].last_updated).add(cached_data[type].interval, 'seconds') >= moment()
}

function get_cached_data(type) {
    if (!cached_data[type]?.data ?? null)
        return null;
    let result = cached_data[type].data;
    if (Array.isArray(result))
        return result;
    if('DATA' in result) {
        // SQL constructed
        result = cached_data[type].data.DATA?.[0]?.rows ?? null;
        return result;
    }
    return result
}

function get_cached_value(filter, type) {
    const local_cache = get_cached_data(type);
    if (!local_cache)
        return null;
    return _.find(local_cache, filter);
}

function init_cache_update_task() {
    if (conf.CACHE.cache_update_task) {
        setInterval(_auto_cache_update, conf.CACHE.cache_update_interval * 1000)
        utils.debug(`Task to update cache created with interval: ${conf.CACHE.cache_update_interval} seconds`);
        setTimeout(() => {
            _auto_cache_update();
        }, 3000)
    }
}
let _auto_cache_update = function() {
    utils.debug(`AUTO: Cache updated fired.`, null, 'debug');
    Object.keys(conf.CACHE.DATA).forEach(key => {
        const cache_entry = conf.CACHE.DATA[key];
        if (!has_cache(key)) {
            utils.debug(` - Cache ${key} - need update`, null, 'debug');
            _process_cache_update(
                key, cache_entry.method, cache_entry.module, cache_entry?.method_sub ?? null);
        } else {
            utils.debug(` - Cache ${key} - at actual state`, null, 'debug');
        }
    })
}
function _process_cache_update(key, method, mod, method_sub) {
    // 'key' here for possible exceptions
    let loc_mod = null;

    switch(mod) {
        case 'db_main' : {
            loc_mod = require('./db_main');
            break;
        }
    }
    if (!loc_mod)
        return;
    if (method_sub) {
        loc_mod[method_sub][method]();
    } else {
        loc_mod[method]();
    }
}


module.exports = {
    cached_data: cached_data,
    cached: cached,
    init_cached_data: () => init_cached_data(),
    init_cache_update_task: () => init_cache_update_task(),
    get_cached_data: (type) => get_cached_data(type),
    get_cached_value: (filter, type) => get_cached_value(filter, type)
}

