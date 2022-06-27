const responderasync = require('./util/responderasync');
const auth = require('./util/auth');
const controllers = require('../controllers');
const logger = require('../logger');
const { promInitConfig } = require('../../config');


module.exports.handler = async (event, context, callback) => {;
    let newProm = new Promise((resolve,reject) => {
        promInitConfig.then( (value) => {
            let hdrHost = event?.headers?.Host;
            let authIssuer;
            if (hdrHost)
            {
                authIssuer = auth.getIssuer(event.headers.Host, event.requestContext && event.requestContext.stage);
            }
            else
            {
                logger.error(`openIdConfiguration no hdrHost`);
            }
    
            controllers(responderasync(resolve)).openIdConfiguration(authIssuer);
        }, (err) => {
            let msg = `open-id-configuration.handler; ${err}`;
            logger.error(msg); 
            reject(msg);
        });
    });

    return newProm;
};
