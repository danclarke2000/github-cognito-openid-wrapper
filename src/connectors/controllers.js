const logger = require('./logger');
const openid = require('../openid');

module.exports = (respond) => ({
  authorize: (client_id, scope, state, response_type) => {
    logger.debug(`controllers.authorize client_id=${client_id}, scope=${scope}, state=${state}, response_type=${response_type}`);
    const authorizeUrl = openid.getAuthorizeUrl(
      client_id,
      scope,
      state,
      response_type
    );
    logger.info(`Redirecting to authorizeUrl=${authorizeUrl}`);
    respond.redirect(authorizeUrl);
  },
  userinfo: (tokenPromise) => {
    tokenPromise
      .then((token) => openid.getUserInfo(token))
      .then((userInfo) => {
        logger.debug('Resolved user infos:', userInfo, {});
        respond.success(userInfo);
      })
      .catch((error) => {
        logger.error(
          'Failed to provide user info: %s',
          error.message || error,
          {}
        );
        respond.error(error);
      });
  },
  token: (code, state, host) => {
    if (code) {
      logger.debug(
        'Requesting Token for (%s, %s, %s)', code, state, host, {});
      openid
        .getTokens(code, state, host)
        .then((tokens) => {
            logger.debug(`controllers.js!token return ${JSON.stringify(tokens)}`);
            logger.debug('Token for (%s, %s, %s) provided',
                code, state, host, {});
            respond.success(tokens);
        })
        .catch((error) => {
            logger.error(
                'Token for (%s, %s, %s) failed: %s',
                code, state, host,
                error.message || error, {});
            respond.error(error);
        });
    } else {
      const error = new Error('No code supplied');
      logger.error(
        'Token for (%s, %s, %s) failed: %s',
        code,
        state,
        host,
        error.message || error,
        {}
      );
      respond.error(error);
    }
  },
  jwks: () => {
    const jwks = openid.getJwks();
    logger.info('Providing access to JWKS: %j', jwks, {});
    respond.success(jwks);
  },
  openIdConfiguration: (host) => {
    const config = openid.getConfigFor(host);
    logger.debug('Providing configuration for %s: %j', host, config, {});
    respond.success(config);
  },
});
