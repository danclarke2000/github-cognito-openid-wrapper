const responder = require('./util/responder');
const controllers = require('../controllers');
const logger = require('../logger');

module.exports.handler = (event, context, callback) => {
    controllers(responder(callback)).jwks();
};
