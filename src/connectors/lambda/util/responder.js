const logger = require('../../logger');

module.exports = (callback) => ({
  success: (response) => {
    logger.info('Success response');
    callback(null, {
      statusCode: 200,
      body: JSON.stringify(response),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
  error: (err) => {
    logger.error('Error response: ', err.message || err);
    callback(null, {
      statusCode: 400,
      body: JSON.stringify(err.message),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
  redirect: (url) => {
    logger.info('Redirect response');
    logger.debug('Redirect response to %s ',  url.toString(), {});
    callback(null, {
      statusCode: 302,
      headers: {
        Location: url,
      },
    });
  },
});
