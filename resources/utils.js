const conf = require('./config');
const moment = require('moment');

// DEBUG
function debug(message, error = null, level = 'info', logger = 'main') {
    let log_str = `::: ${moment().format('YYYY-MM-DD HH:mm:ss')} - ${message}`
    if (error instanceof Error) {
        log_str += `
    Stacktrace: ${error.stack}`
    }
    if (conf.ENV_IS_DEV)
        console.log(log_str)
    $LOGGER.entry(log_str, level, logger)
}

module.exports = {
    'debug': (message, error = null, level = 'info', logger = 'main') => debug(message, error, level, logger),
}