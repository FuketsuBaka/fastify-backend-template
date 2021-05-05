const conf = require('../resources/config');
const utils = require('../resources/utils');
const moment = require('moment');

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

module.exports = {
    cached_data: cached_data,
    cached: cached,
    init_cached_data: () => init_cached_data(),
}

