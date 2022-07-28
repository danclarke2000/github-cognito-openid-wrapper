const responderasync = require('./util/responderasync');
const auth = require('./util/auth');
const controllers = require('../controllers');
const { promInitConfig } = require('../../config');
const logger = require('../logger');

module.exports.handler = async (event, context, callback) => {
    logger.debug(`Handler userinfo event=: ${JSON.stringify(event)}, context=${JSON.stringify(context)}`);
    let newProm = new Promise((resolve,reject) => {

        promInitConfig.then( (value) => {
            controllers(responderasync(resolve)).userinfo(auth.getBearerToken(event));
        }, (err) => {
            let msg = `userinfo.handler; ${err}`;
            logger.error(msg); 
            reject(msg);
        });
    });

    return newProm;
};
