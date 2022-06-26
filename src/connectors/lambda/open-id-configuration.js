const responder = require('./util/responder');
const auth = require('./util/auth');
const controllers = require('../controllers');
const logger = require('../logger');

module.exports.handler = (event, context, callback) => {
    let hdrHost = event?.headers?.Host;
    let authIssuer;
    if (hdrHost)
    {
        authIssuer = auth.getIssuer(event.headers.Host, event.requestContext && event.requestContext.stage);
    }
    else
    {
        let reqHeaders = (req && req.headers) ? JSON.stringify(req.headers) : 'missing';
        logger.error(`openIdConfiguration no hdrHost; reqHeaders=${reqHeaders}`);
    }

    controllers(responder(callback)).openIdConfiguration(authIssuer);
};
