const logger = require('./connectors/logger');
const axios = require('axios');
const { NumericDate } = require('./helpers');
const crypto = require('./crypto');
const github = require('./github');
const { promInitConfig } = require('./config');
const { DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { inspect } = require('util');

let myConfig2 = undefined;
promInitConfig.then( (value) => {
    myConfig2 = value;
}, (err) => {
    logger.error(`openid.js promInitConfig ${err}`);
});

const getJwks = () => {
    logger.debug('getJwks');
    return { keys: [crypto.getPublicKey()] }
};

const getUserInfo = (accessToken) =>
  Promise.all([
    github()
      .getUserDetails(accessToken) 
      .then((userDetails) => {
        logger.debug('Fetched user details: %j', userDetails, {});
        // Here we map the github user response to the standard claims from
        // OpenID. The mapping was constructed by following
        // https://developer.github.com/v3/users/
        // and http://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
        const claims = {
          sub: `${userDetails.id}`, // OpenID requires a string
          name: userDetails.name,
          preferred_username: userDetails.login,
          profile: userDetails.html_url,
          picture: userDetails.avatar_url,
          website: userDetails.blog,
          updated_at: NumericDate(
            // OpenID requires the seconds since epoch in UTC
            new Date(Date.parse(userDetails.updated_at))
          ),
        };
        logger.debug('Resolved claims: %j', claims, {});
        return claims;
      }),
    github()
      .getUserEmails(accessToken)
      .then((userEmails) => {
        logger.debug('Fetched user emails: %j', userEmails, {});
        const primaryEmail = userEmails.find((email) => email.primary);
        if (primaryEmail === undefined) {
          throw new Error('User did not have a primary email address');
        }
        const claims = {
          email: primaryEmail.email,
          email_verified: primaryEmail.verified,
        };
        logger.debug('Resolved claims: %j', claims, {});
        return claims;
      }),
    github()
      .getUserMembershipOrgs(accessToken)
      .then((userOrgs) => {
        logger.debug('Fetched user userOrgs: ' + JSON.stringify(userOrgs), {});
        let mappedUserOrgs = userOrgs.map(el => el.organization.login)                
        const claims = {
            "custom:userOrgs": JSON.stringify(mappedUserOrgs),
            // we have to encode the orgs into the address because cognito/alb doesnt allow a way to map custom claims
            "address": JSON.stringify(mappedUserOrgs),
        };
        logger.debug('Resolved claims: %j', claims, {});
        return claims;
      }),
  ]).then((claims) => {
    const mergedClaims = claims.reduce(
      (acc, claim) => ({ ...acc, ...claim }),
      {}
    );
    logger.debug('Resolved combined claims: %j', mergedClaims, {});
    return mergedClaims;
  });

const getAuthorizeUrl = (client_id, scope, state, response_type) =>
  github().getAuthorizeUrl(client_id, scope, state, response_type);

const getTokens = (code, state, host) =>
  promInitConfig.then((value) => {
    return github()
        .getToken(code, state)
        .then((githubToken) => {
            logger.debug(`openid.js!getTokens - Got token: ${JSON.stringify(githubToken)}`);
            // GitHub returns scopes separated by commas
            // But OAuth wants them to be spaces
            // https://tools.ietf.org/html/rfc6749#section-5.1
            // Also, we need to add openid as a scope,
            // since GitHub will have stripped it
            const scope = `openid ${githubToken.scope.replace(',', ' ')}`;

            let promGithubUserMemberships = axios.get('https://api.github.com/user/memberships/orgs', {
                headers: {
                  Accept: 'application/vnd.github.v3+json',
                  Authorization: `token ${githubToken.access_token}`,
                },
            });

            let promGithubUserDetails = axios.get('https://api.github.com/user', {
                headers: {
                  Accept: 'application/vnd.github.v3+json',
                  Authorization: `token ${githubToken.access_token}`,
                },
            });

            // prepare token
            // prepare token response
            const payload = {
                // This was commented because Cognito times out in under a second
                // and generating the userInfo takes too long.
                // It means the ID token is empty except for metadata.
                //  ...userInfo,
            };

            const idToken = crypto.makeIdToken(payload, host);
            const tokenResponse = {
                ...githubToken,
                scope,
                id_token: idToken,
            };

            // ** JWT ID Token required fields **
            // iss - issuer https url
            // aud - audience that this token is valid for (GITHUB_CLIENT_ID)
            // sub - subject identifier - must be unique
            // ** Also required, but provided by jsonwebtoken **
            // exp - expiry time for the id token (seconds since epoch in UTC)
            // iat - time that the JWT was issued (seconds since epoch in UTC)
            let githubUsername = 'TBD###';
            let dydbItemPayload = {                
                "githubUsername": githubUsername,
                "cognitoId": '',
                "email": '',
                "githubOrgs": JSON.stringify([]),
                "token_issue_date": NumericDate(new Date()),
                "access_token":githubToken.access_token,
                "access_token_expires_in":githubToken.expires_in,
                "refresh_token":githubToken.refresh_token,
                "refresh_token_expires_in":githubToken.refresh_token_expires_in,
                "expired":false,
                "expiredAt":null
            };

            return new Promise((resolve, reject) => {
                logger.debug(`openid.js!getTokens - Promise body`);
                let result = { "statusCode": 500 };
                Promise.all([promGithubUserMemberships, promGithubUserDetails]).then((values) => 
                {
                    try
                    {
                        logger.debug(`openid.js!Promise.all body - isArray(values)=${Array.isArray(values)} arrLen=${Array.isArray(values) ? values.length : -1 },  Object.keys=${Object.keys}`);
                        
                        let valueMemberships = values[0].data;                        
                        if (Array.isArray(valueMemberships))
                        {
                            if (0 < valueMemberships.length) {
                                dydbItemPayload.githubOrgs = valueMemberships.map(el => el.organization.login)                                
                            } else {
                                logger.debug(`openid.js!promGithubUserMemberships - empty memberships for githubUsername=${githubUsername}`);                                                    
                                dydbItemPayload.githubOrgs = [];
                            }

                            let myRequiredOrgAsStr = process.env.GHAPP_REQUIRED_ORG;
                            let myRequiredOrg = JSON.stringify(myRequiredOrgAsStr);
                            if (Array.isArray(myRequiredOrg) && 0 < myRequiredOrg.length) {
                              if (true == myRequiredOrg.some(el => dydbItemPayload.githubOrgs.includes(el))) {
                                result.statusCode = 200;   
                              } else {
                                logger.debug(`openid.js!promGithubUserMemberships - githubOrgs does not contain=${myRequiredOrg}`);
                                result.statusCode = 403;   
                              }
                            } else {
                              result.statusCode = 200; 
                            }

                        } else {
                            logger.error(`openid.js!promGithubUserMemberships - unxpected value; typeof valueMemberships=${typeof valueMemberships}, isArray=${Array.isArray(valueMemberships)}, valueMemberships=${inspect(valueMemberships)}`);

                            let jsonObj = JSON.parse(valueMemberships);
                            logger.error(`openid.js!promGithubUserMemberships - unxpected value; typeof jsonObj=${typeof jsonObj}, isArray=${Array.isArray(jsonObj)}, jsonObj=${inspect(jsonObj)}`);

                            result.statusCode = 510; 
                            reject(result);
                        }

                        if (200 == result.statusCode) {
                            let valueUserInfo = values[1].data;                        
                            if ("string" == typeof valueUserInfo?.login) {
                                logger.debug(`openid.js!promGithubUserDetails - value=${valueUserInfo.login}`);
                                dydbItemPayload.githubUsername = valueUserInfo.login;
                            } else {
                                logger.error(`openid.js!promGithubUserDetails - unxpected value= typeof valueUserInfo=${typeof valueUserInfo}`);                        

                                let jsonObj = JSON.parse(valueUserInfo);
                                logger.error(`openid.js!valueUserInfo - unxpected value; typeof jsonObj=${typeof jsonObj}, isArray=${Array.isArray(jsonObj)}, jsonObj=${inspect(jsonObj)}`);


                                result.statusCode = 512;  
                                reject(result);
                            }

                            let tableName = process.env.DynameDbTableForGithubState;
                            if ("string" == typeof tableName && 0 < tableName.length
                                && "string" == typeof dydbItemPayload.githubUsername && dydbItemPayload.githubUsername.length > 3)
                            {
                                let githubUsername = dydbItemPayload.githubUsername;
                                let dydbItem = {
                                    "TableName": tableName,
                                    "Item" : dydbItemPayload
                                }; 
                                logger.debug(`openid.js!getTokens - Calling lambda2 with githubUsername=${githubUsername}, dydbItem=${JSON.stringify(dydbItem)}`);
                                const ddbClient = new DynamoDBClient({ region: "eu-west-1" });
                                const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
                                ddbDocClient.send(new PutCommand(dydbItem)).then( (data) => {
                                    result.statusCode = data?.$metadata?.httpStatusCode;
                                    logger.debug(`updateGithubStateAfterAuthz!dynamodb.putItem ok githubUsername=${githubUsername}, result.statusCode=${result.statusCode}`);
                                    resolve(tokenResponse);
                                }, (error) => {
                                    let errMsg = (error.message)? error.message : JSON.stringify(error);
                                    let errStack = (error.stack)? error.stack : 'err stack not available';
                                    logger.error(`updateGithubStateAfterAuthz!dynamodb.putItem error=${errMsg}, stack=${errStack}`);
                                    result.statusCode = 503;  

                                    // we resolve successfully even though we failed to update dynamodb
                                    resolve(tokenResponse);
                                });
                            }
                            else
                            {
                                logger.error(`updateGithubStateAfterAuthz!dynamodb.putItem event has no githubUsername or tableName; tableName=${tableName}, githubUsername=${githubUsername}`);
                                result.statusCode = 502;  
                                reject(result);
                            }
                        } else {
                          // authZ failure
                          reject(result);
                        }
                    } catch (error) {
                        let errMsg = (error.message)? error.message : JSON.stringify(error);
                        let errStack = (error.stack)? error.stack : 'err stack not available';
                        logger.error(`updateGithubStateAfterAuthz!dynamodb.putItem error=${errMsg}, stack=${errStack}`);
                        result.statusCode = 501;  
                        reject(result);
                    } 
                }).catch((err) => {
                    logger.error(`updateGithubStateAfterAuthz!dynamodb.Promise.all reject ${err.message}`);
                    result.statusCode = 504;
                    reject(result);
                })
                
            });
                /*
                - dont do it this way as lambda cold starts cause timeouts
                const client = new LambdaClient({ region: "eu-west-1" })
                let lmbinvokeInput /* : InvokeCommandInput * / = {
                    FunctionName: 'gitrospectCognito-stg-updateGithubStateAfterAuthz',
                    Payload: JSON.stringify(dydbItem)
                };
                const command = new InvokeCommand(lmbinvokeInput);
                let promInvokeLambda = client.send(command);
                logger.debug(`openid.js!getTokens - waiting lambda2 promise `);
                promInvokeLambda.then( (value) => {
                    let statusCode = value.StatusCode;
                    logger.debug(`openid.js!promInvokeLambda; value keys - : ${JSON.stringify(Object.keys(value))}`)
                    logger.debug(`openid.js!promInvokeLambda ok; statusCode=${statusCode}`);

                    logger.debug('Resolved token response success', {});
                    resolve(tokenResponse);
                }, (err) => {
                    logger.error(`openid.js!promInvokeLambda; error keys - : ${JSON.stringify(Object.keys(err))}`)
                    logger.error(`openid.js!promInvokeLambda; error - : ${JSON.stringify(err)}`);
                    console.log("Error", err.stack);

                    logger.debug('Resolved token response failure', {});
                    resolve(tokenResponse);
                }); */

        });
    });

const getConfigFor = (host) => ({
  issuer: `https://${host}`,
  authorization_endpoint: `https://${host}/authorize`,
  token_endpoint: `https://${host}/token`,
  token_endpoint_auth_methods_supported: [
    'client_secret_basic',
    'private_key_jwt',
  ],
  token_endpoint_auth_signing_alg_values_supported: ['RS256'],
  userinfo_endpoint: `https://${host}/userinfo`,
  // check_session_iframe: 'https://server.example.com/connect/check_session',
  // end_session_endpoint: 'https://server.example.com/connect/end_session',
  jwks_uri: `https://${host}/.well-known/jwks.json`,
  // registration_endpoint: 'https://server.example.com/connect/register',
  scopes_supported: ['openid', 'read:user', 'user:email', 'custom:userOrgs'],
  response_types_supported: [
    'code',
    'code id_token',
    'id_token',
    'token id_token',
  ],

  subject_types_supported: ['public'],
  userinfo_signing_alg_values_supported: ['none'],
  id_token_signing_alg_values_supported: ['RS256'],
  request_object_signing_alg_values_supported: ['none'],
  display_values_supported: ['page', 'popup'],
  claims_supported: [
    'sub',
    'name',
    'preferred_username',
    'profile',
    'picture',
    'website',
    'email',
    'email_verified',
    'updated_at',
    'iss',
    'aud',
    'custom:userOrgs',
    'address'
  ],
});

module.exports = {
  getTokens,
  getUserInfo,
  getJwks,
  getConfigFor,
  getAuthorizeUrl,
};
