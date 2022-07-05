const qs = require('querystring');
const responderasync = require('./util/responderasync');
const auth = require('./util/auth');
const controllers = require('../controllers');
const logger = require('../logger');
const { promInitConfig } = require('../../config');

const parseBody = (event) => {
  const contentType = event.headers['Content-Type'];
  if (event.body) {
    if (contentType.startsWith('application/x-www-form-urlencoded')) {
      return qs.parse(event.body);
    }
    if (contentType.startsWith('application/json')) {
      return JSON.parse(event.body);
    }
  }
  return {};
};

module.exports.handler = async (event, context) => {
    logger.debug(`tokenHandler ${JSON.stringify(event)}`); 
    const body = parseBody(event);
    const query = event.queryStringParameters || {};

    const code = body.code || query.code;
    const state = body.state || query.state;
    
    let newProm = new Promise((resolve,reject) => {
        let iss = auth.getIssuer(
            event.headers.Host,
            event.requestContext && event.requestContext.stage
        );
        promInitConfig.then( (value) => {
            logger.debug(`tokenHandler code=${code} state=${state} iss=${iss}`); 
            controllers(responderasync(resolve)).token(
                code,
                state,
                iss 
            );
        }, (err) => {
            let msg = `token.handler; ${err}`;
            logger.error(msg); 
            reject(msg)
        });
    });

    return newProm;
};
