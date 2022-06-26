const responder = require('./responder');
const auth = require('./auth');
const controllers = require('../controllers');
const logger = require('../logger');

module.exports = {
  userinfo: (req, res) => {
    controllers(responder(res)).userinfo(auth.getBearerToken(req));
  },
  token: (req, res) => {
    const code = req.body.code || req.query.code;
    const state = req.body.state || req.query.state;

    controllers(responder(res)).token(code, state, req.get('host'));
  },
  jwks: (req, res) => controllers(responder(res)).jwks(),
  authorize: (req, res) =>
    responder(res).redirect(
      `https://github.com/login/oauth/authorize?client_id=${req.query.client_id}&scope=${req.query.scope}&state=${req.query.state}&response_type=${req.query.response_type}`
    ),
  openIdConfiguration: (req, res) => {
    let hdrHost = req.get('host');
    let authIssuer = auth.getIssuer(hdrHost);
    logger.info(`openIdConfiguration hdrHost=${hdrHost} authIssuer=${authIssuer}`);
    controllers(responder(res)).openIdConfiguration(authIssuer);
  },
};
