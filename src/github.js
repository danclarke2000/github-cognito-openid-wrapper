const axios = require('axios');
const logger = require('./connectors/logger');
const { promInitConfig, myconfig, syncGetConfig } = require('./config');

let myConfig2 = undefined;
promInitConfig.then( (value) => {
    logger.info(`github.js;promInitConfig setting value}`);
    myConfig2 = value;
}, (err) => {
    logger.error(`github.js promInitConfig ${err}`);
});

const getApiEndpoints = (
  apiBaseUrl,
  loginBaseUrl
) => 
{
    apiBaseUrl = myConfig2?.GITHUB_API_URL;
    loginBaseUrl = myConfig2?.GITHUB_LOGIN_URL;
    logger.debug(`getApiEndpoints2 apiBaseUrl=${apiBaseUrl}, loginBaseUrl=${loginBaseUrl}`);
    let r = {
        userDetails: `${apiBaseUrl}/user`,
        userEmails: `${apiBaseUrl}/user/emails`,
        oauthToken: `${loginBaseUrl}/login/oauth/access_token`,
        oauthAuthorize: `${loginBaseUrl}/login/oauth/authorize`,
    }

    return r;
};

const checkOauthToken = (response) => {
    let respKeys = Object.keys(response);
    let respHdrs = response.headers ? JSON.stringify(response.headers) : 'no headers';
    let respData = response.data ? JSON.stringify(response.data) : 'no data';
    logger.debug(`checkOauthToken: Checking response: status=${response.status} respHdrs=${respHdrs} respData=${respData}`, {});
    return check(response);
}

const checkUserDetails = (response) => {
    let respKeys = Object.keys(response);
    let respHdrs = response.headers ? JSON.stringify(response.headers) : 'no headers';
    let respData = response.data ? JSON.stringify(response.data) : 'no data';
    logger.debug(`checkUserDetails: Checking response: status=${response.status} respHdrs=${respHdrs} respData=${respData}`, {});
    return check(response);
}

const checkUserEmails = (response) => {
    let respKeys = Object.keys(response);
    let respHdrs = response.headers ? JSON.stringify(response.headers) : 'no headers';
    let respData = response.data ? JSON.stringify(response.data) : 'no data';    
    logger.debug(`checkUserEmails: Checking response: status=${response.status} respHdrs=${respHdrs} respData=${respData}`, {});
    return check(response);
}

const check = (response) => {
  
  if (response.data) {
    if (response.data.error) {
      throw new Error(
        `GitHub API responded with a failure: ${response.data.error}, ${response.data.error_description}`
      );
    } else if (response.status === 200) {
      return response.data;
    }
  }
  throw new Error(
    `GitHub API responded with a failure: ${response.status} (${response.statusText})`
  );
};

const gitHubGet = (url, accessToken) =>
  axios({
    method: 'get',
    url,
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${accessToken}`,
    },
  });

module.exports = (apiBaseUrl, loginBaseUrl) => {
  const urls = getApiEndpoints(apiBaseUrl, loginBaseUrl || apiBaseUrl);
  return {
    getAuthorizeUrl: (client_id, scope, state, response_type) =>
      `${urls.oauthAuthorize}?client_id=${client_id}&scope=${encodeURIComponent(
        scope
      )}&state=${state}&response_type=${response_type}`,
    getUserDetails: (accessToken) =>
      gitHubGet(urls.userDetails, accessToken).then(checkUserDetails),
    getUserEmails: (accessToken) =>
      gitHubGet(urls.userEmails, accessToken).then(checkUserEmails),
    getUserMembershipOrgs: (accessToken) => 
        gitHubGet('https://api.github.com/user/memberships/orgs', accessToken).then(check),
    getToken: (code, state) => {
      const data = {
        // OAuth required fields
        grant_type: 'authorization_code',
        redirect_uri: myConfig2.COGNITO_REDIRECT_URI,
        client_id: myConfig2.GITHUB_CLIENT_ID,
        // GitHub Specific
        response_type: 'code',
        client_secret: myConfig2.GITHUB_CLIENT_SECRET,
        code,
        // State may not be present, so we conditionally include it
        ...(state && { state }),
      };

      logger.debug(
        'Getting token from %s with data: %j',
        urls.oauthToken,
        data,
        {}
      );
      return axios({
        method: 'post',
        url: urls.oauthToken,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        data,
      }).then(checkOauthToken);
    },
  };
};
