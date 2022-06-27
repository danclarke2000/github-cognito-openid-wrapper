const responderasync = require('./util/responderasync');
const controllers = require('../controllers');
const logger = require('../logger');
const { promInitConfig } = require('../../config');

module.exports.handler = async (event, context) => {
    const { client_id, scope, state, response_type } = event.queryStringParameters;
    logger.debug(`handler.authorize event=${JSON.stringify(event)}`);
    logger.debug(`handler.authorize client_id=${client_id}, scope=${scope}, state=${state}, response_type=${response_type}`);

    let newProm = new Promise((resolve,reject) => {
        promInitConfig.then( (value) => {
            controllers(responderasync(resolve)).authorize(
                client_id,
                scope,
                state,
                response_type
            );
        }, (err) => {
            let msg = `authorize.handler; ${err}`;
            logger.error(msg); 
            reject(msg); 
        });
    });
    
    return newProm;
};
