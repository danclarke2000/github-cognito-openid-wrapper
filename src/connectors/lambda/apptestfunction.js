const logger = require('../logger');
const { LambdaClient, InvokeCommand, InvokeCommandInput } = require("@aws-sdk/client-lambda");

module.exports.handler = async (event, context) => {
    logger.debug(`apptestfn `);
    let newProm = new Promise((resolve,reject) => {

        let githubUsername = (event.githubUsername) ? event.githubUsername : 'unknown';
        logger.debug(`apptestfn - Calling lambda2 with githubUsername=${githubUsername}`);
        const client = new LambdaClient({ region: "eu-west-1" })
        let lmbinvokeInput /* : InvokeCommandInput */ = {
            FunctionName: 'gitrospectCognito-stg-updateGithubStateAfterAuthz',
            Payload: JSON.stringify(event)
        };

        const command = new InvokeCommand(lmbinvokeInput);
        let promInvokeLambda = client.send(command);
        promInvokeLambda.then( (value) => {
            logger.debug(`apptestfn!promInvokeLambda ok; data keys=${JSON.stringify(Object.keys(value), null, '  ')}`);
            logger.debug(`apptestfn!promInvokeLambda ok; data=${JSON.stringify(value, null, '  ')}`);
            console.log(`apptestfn!promInvokeLambda ok; data=${JSON.stringify(value, null, '  ')}`);
            resolve(value);
        }, (err) => {
            logger.error(`openid.js!promInvokeLambda; error keys - : ${JSON.stringify(Object.keys(err))}`);
            logger.error(`openid.js!promInvokeLambda; error - : ${JSON.stringify(err)}`);
            console.log("Error", err.stack);
            reject(err)
        });

        logger.debug('Done', {});        
    });

    return newProm;
};
