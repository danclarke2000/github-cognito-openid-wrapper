// const config = require('./config');
import { promInitConfig } from './config';
import logger from './connectors/logger';

const ensureString = (variableName) => {
  if (typeof MyConfig[variableName] !== 'string') {
    throw new Error(
      `Environment variable ${variableName} must be set and be a string`
    );
  }
};

const ensureNumber = (variableName) => {
  if (typeof MyConfig[variableName] !== 'number') {
    throw new Error(
      `Environment variable ${variableName} must be set and be a number`
    );
  }
};

const requiredStrings = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'COGNITO_REDIRECT_URI',
  'SecretName',
  'AWS_REGION'
];

const requiredNumbers = ['PORT'];

module.exports = async () => {
    let ret = Promise((resolve,reject) => {
        promInitConfig.then((value) => {
            logger.debug(`validate-config; checking config`);
            requiredStrings.forEach(ensureString);
            requiredNumbers.forEach(ensureNumber);
            logger.debug(`validate-config; done checking config`);
            resolve(value);
        }, (err) => {
            logger.error(`validate-config; promise error ${err}`);
            reject(err);
        });
    });

    return ret;
};
