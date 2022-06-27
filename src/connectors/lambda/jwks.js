const responderasync = require('./util/responderasync');
const controllers = require('../controllers');
const logger = require('../logger');
const { promInitConfig } = require('../../config');

module.exports.handler = async (event, context) => {
    logger.debug(`jwks ${JSON.stringify(event)}`); 

    let newProm = new Promise((resolve,reject) => {
        promInitConfig.then( (value) => {
            controllers(responderasync(resolve)).jwks();
        }, (err) => {
            let msg = `jwks.handler; ${err}`;
            logger.error(msg); 
            reject(msg);
        });
    });

    return newProm;
};
