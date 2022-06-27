const JSONWebKey = require('json-web-key');
const jwt = require('jsonwebtoken');
const { promInitConfig, myconfig, syncGetConfig } = require('./config');
const logger = require('./connectors/logger');


let myConfig2 = undefined;
promInitConfig.then( (value) => {
    myConfig2 = value;
}, (err) => {
    logger.error(`cyrpto.js promInitConfig ${err}`);
});


const KEY_ID = 'jwtRS256';
// const cert = require('../jwtRS256.key');
// const pubKey = require('../jwtRS256.key.pub');

let m_resultGetPublicKey = {
    alg: 'RS256',
    kid: KEY_ID,
    // ...JSONWebKey.fromPEM(pubKey).toJSON(),
  };

module.exports = {
  getPublicKey: () => {
    // these are base64 encoded
    let b64PubKey = myConfig2.B64_JWT_KEY_PUBLIC;
    let certFormattedForPem = (b64PubKey && Buffer.from(b64PubKey, 'base64').toString());
    let r = {
        alg: 'RS256',
        kid: KEY_ID,
        ...JSONWebKey.fromPEM(certFormattedForPem).toJSON(),
    };
    
    return r;
  },

  makeIdToken: (payload, host) => {
    let myAud = myConfig2.GITHUB_CLIENT_ID;
    let b64Cert = myConfig2.B64_JWT_KEY_PRIVATE;
    let certFormattedForPem = (b64Cert && Buffer.from(b64Cert, 'base64').toString());
    let certLen = (certFormattedForPem) ? certFormattedForPem.length : -1;
    logger.debug(`makeIdToken myAud=${myAud} certLen=${certLen}`);
    const enrichedPayload = {
      ...payload,
      iss: `https://${host}`,
      aud: myAud,
    };

    let msg = `Signing payload ${JSON.stringify(enrichedPayload)}, host=${host}`;
    logger.debug(msg);
    return jwt.sign(enrichedPayload, certFormattedForPem, {
      expiresIn: '1h',
      algorithm: 'RS256',
      keyid: KEY_ID,
    });
  },
};
