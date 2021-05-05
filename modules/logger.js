// You cant assign 2 and more loggers normally
// but we can create special instance to contain our desired logging methods
const pino = require('pino');
const moment = require('moment');
const fs = require('fs');
const conf = require('../resources/config');

class LOGGER {
    constructor(default_logger_name = null) {
        // To be accessed on instance
        this.loggers = {};
        this.default_logger = default_logger_name;

        const logs = Object.keys(conf.APP.LOGS);
        logs.forEach(key => {
            if (!this.default_logger || this.default_logger === '')
                this.default_logger = key.toLowerCase();
            this.loggers[key.toLowerCase()] = new PINO_LOGGER(conf.APP.LOGS[key].path, conf.APP.LOGS[key].level, conf.APP.LOGS[key].rotate);
        })
    }
    get default() {
        return this.loggers[this.default_logger];
    }
    entry(log_str, level, logger = null) {
        if (!logger)
            logger = this.default_logger;
        const logger_l = logger.toLowerCase();
        if (this.loggers.hasOwnProperty(logger_l)) {
            if (this.loggers[logger_l] instanceof PINO_LOGGER) {
                this.loggers[logger_l].entry(log_str, level)
            } else {
                console.log(`Logger '${logger_l}' is not instance of PINO-Logger!`)
            }
        } else {
            console.log(`Logger '${logger_l}' not found or not initialized!`)
        }
    }
}

class PINO_LOGGER {
    constructor(log_path, level = 'info', rotate = false) {
        this.log_path = log_path;
        this.level = level;
        this.rotate = rotate;
        this.logger = null;
        this.init_pino_logger()
    }
    async init_pino_logger() {
        this.logger = null;
        this.logger = pino({
            prettyPrint: {
                colorize: false,
            },
            level: this.level,
        }, pino.destination(this.log_path));
        let timeout = new Promise((resolve) => {
            setTimeout(() => resolve(true), 1000)
        });
        await timeout;
        console.log(`Logger initialized to path: ${this.log_path}`)
        return true;
    }
    entry(log_str, level) {
        if (this.logger.isLevelEnabled(level)) {
            this.rotate_if().then( () => {
                this.logger[level](log_str);
            });
        }
    }
    async rotate_if() {
        if (!fs.existsSync(this.log_path)) {
            this.touch(this.log_path);
            return true;
        }
        if (!this.rotate) {
            return true;
        }
        const last_updated = moment(fs.statSync(this.log_path).mtime);
        if (moment().startOf('day') > last_updated) {
            // Current date
            console.log(`Rotated: ${this.log_path}
    Reason: ${moment().startOf('day')} > ${last_updated}`);

            await rotate_by_date(this.log_path, last_updated)
            if (!fs.existsSync(this.log_path))
                this.touch(this.log_path);
            await this.init_pino_logger();
        }
    }
    touch(log_path) {
        fs.closeSync(fs.openSync(log_path, 'w'));
    }
}

async function rotate_by_date(log_path, last_updated) {
    let log_ext = file_ext(log_path);
    let log_path_noext = log_path;
    if (log_ext.length > 0) {
        log_ext = `.${log_ext}`;
        log_path_noext = log_path.slice(0, log_ext.length * -1);
    }
    const new_log_path = `${log_path_noext}-${moment(last_updated).format('YYYY-MM-DD')}${log_ext}`;
    fs.rename(log_path, new_log_path, () => {
        fs.closeSync(fs.openSync(log_path, 'w'));
        return true;
    });
}

function file_ext(filename) {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
}

module.exports = LOGGER;