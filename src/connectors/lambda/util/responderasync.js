const logger = require('../../logger');

module.exports = (promResolver) => ({
  success: (response) => {
    logger.info('Success response');
    logger.debug('Response was: ', response);
    promResolver({
      statusCode: 200,
      body: JSON.stringify(response),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
  error: (err) => {
    logger.error('Error response: ', err.message || err);
    promResolver({
      statusCode: 400,
      body: JSON.stringify(err.message),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
  redirect: (url) => {
    logger.info('Redirect response');
    logger.debug('Redirect response to ', url.toString(), {});
    promResolver({
      statusCode: 302,
      headers: {
        Location: url,
      },
    });
  },
});
