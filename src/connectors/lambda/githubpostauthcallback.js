const logger = require('../logger');

module.exports.handler = (event, context, callback) => {
    // github calls this after install, we cant redirect direclty to an cognito idp resonse ALB auth action because:
    // 1) github makes a pre-install call to the same url (with setup_action param) which cognito finds invalid
    let fnName = "githubpostauthcallback";
    let albHostname = process.env["ALB_LOGIN_URL"];
    let idpUrl = process.env["IDP_URL"];
    const query = event.queryStringParameters || {};
    logger.debug(`${fnName} - albHostname=${albHostname}, idpUrl=${idpUrl}, query=${JSON.stringify(query)}, event={${JSON.stringify(event)}}`);
    let redirectUrl = '';
    let setupAction = query.setup_action;
    if (setupAction == "install")
    {
        // trigger the login flow of the ALB
        redirectUrl = albHostname;
    }
    else if (query.code && query.state) 
    {
        // installation flow is complete so reload the page
        let codeParam = query.code;
        let stateParam = query.state;
        redirectUrl = `${idpUrl}?code=${codeParam}&state=${stateParam}`
    }
    else
    {
        redirectUrl = `${albHostname}/unknownerrorduringinstall`
    }

    logger.debug(`${fnName}; redirectUrl=:${redirectUrl}:`);
    let response = {
        statusCode: 302,
        headers: {
          Location: redirectUrl,
        },
    };

    return callback(null, response);
};
