const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const logger = require('./connectors/logger');

async function getSecretConfig() 
{
    let result = {
        GITHUB_CLIENT_ID: undefined,
        GITHUB_CLIENT_SECRET: undefined,
        COGNITO_REDIRECT_URI: undefined
    };

    let secretData = undefined;
    let myRegion = process.env.AWS_REGION
    let secretName = process.env.SecretName;
    const client = new SecretsManagerClient({ region: myRegion });
    try 
    {
        if ("string" == typeof secretName && 0 < secretName.length)
        {
            const command = new GetSecretValueCommand({
                SecretId: secretName 
            });
            const secretData = await client.send(command);
            if (secretData && secretData.SecretString)
            {
                const jsonSecret = JSON.parse(secretData.SecretString)
                if ("object" == typeof jsonSecret)
                {
                    let presentVars = [];
                    let missingVars = [];
                    let expectedVars = [ "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "COGNITO_REDIRECT_URI", "B64_JWT_KEY_PUBLIC", "B64_JWT_KEY_PRIVATE" ];
                    expectedVars.forEach((currExpectedVar) => {
                        if ("string" == typeof jsonSecret[currExpectedVar])
                        {
                            result[currExpectedVar] = jsonSecret[currExpectedVar];
                            presentVars.push(`${currExpectedVar} len=${result[currExpectedVar].length}`);
                        }
                        else
                        {
                            missingVars.push(currExpectedVar);
                        } 
                    });
                         
                    logger.debug(`Secret presentVars=${presentVars}`);
                    if (0 < missingVars.length)
                    {                
                        logger.error(`Secret does not contain all vars; ${JSON.stringify(missingVars)}`);
                    }
                }
                else
                {
                    logger.error(`Secret could not be parsed; secretName=${secretName}`);
                }                        
            }
            else 
            {
                logger.error(`Secret is invalid; secretName=${secretName}`);
            }        
        }
        else
        {
            logger.error(`Secret invalid secretName; secretName=${secretName}`);
        }
    } 
    catch (error) 
    {
        logger.error(`Secret exception; ${error}`);
    } 

    return result;
}

let isInit = false;
module.exports.myconfig = {
    SECRET_CANARY:100001
}

module.exports.syncGetConfig = () => {
    logger.debug(`calling syncGetConfig`);
    return module.exports.myconfig;
};

async function asyncGetConfigWithSecrets()
{
    // GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET, COGNITO_REDIRECT_URI
    if (! isInit )
    {
        try 
        {            
            let secretConfig = await getSecretConfig(process.env.SecretName);
            let secretCanary = module.exports.myconfig.SECRET_CANARY + 1;
            let envConfig = {
                SECRET_CANARY: secretCanary,
                GITHUB_CLIENT_ID: secretConfig.GITHUB_CLIENT_ID,
                GITHUB_CLIENT_SECRET: secretConfig.GITHUB_CLIENT_SECRET,
                COGNITO_REDIRECT_URI: secretConfig.COGNITO_REDIRECT_URI,
                B64_JWT_KEY_PUBLIC: secretConfig.B64_JWT_KEY_PUBLIC,
                B64_JWT_KEY_PRIVATE: secretConfig.B64_JWT_KEY_PRIVATE,
                GITHUB_API_URL: process.env.GITHUB_API_URL,
                GITHUB_LOGIN_URL: process.env.GITHUB_LOGIN_URL,
                PORT: parseInt(process.env.PORT, 10) || undefined,
    
                // Splunk logging variables
                SPLUNK_URL: process.env.SPLUNK_URL,
                SPLUNK_TOKEN: process.env.SPLUNK_TOKEN,
                SPLUNK_SOURCE: process.env.SPLUNK_SOURCE,
                SPLUNK_SOURCETYPE: process.env.SPLUNK_SOURCETYPE,
                SPLUNK_INDEX: process.env.SPLUNK_INDEX,
            }

            let secretCanary1 = module.exports.myconfig?.SECRET_CANARY;
            let secretCanary2 = envConfig?.SECRET_CANARY;
            logger.debug(`asyncGetConfigWithSecrets requesting secrets secretCanary1=${secretCanary1} secretCanary2=${secretCanary2}`);
            module.exports.myconfig = envConfig;    
        } catch (error) {            
            logger.error(`asyncGetConfigWithSecrets exception ${error}; secretCanary1=${secretCanary1} secretCanary2=${secretCanary2}`);
            throw error;
        } finally {
            isInit = true;
        }
    } else {
        let secretCanary1 = module.exports.myconfig?.SECRET_CANARY;
        logger.debug(`asyncGetConfigWithSecrets using cached;  secretCanary1=${secretCanary1}`);
    }

    logger.debug(`asyncGetConfigWithSecrets module.exports.myconfig=${module.exports.myconfig}`);
    return Promise.resolve(module.exports.myconfig);
}
const implPromInitConfig = asyncGetConfigWithSecrets();
module.exports.promInitConfig = implPromInitConfig;
logger.info(`config init  start`);
implPromInitConfig.then( (value) => {
    myConfig = value;
    logger.debug(`config init set`);
}, (err) => {
    logger.error(`config init promInitConfig ${err}`);
});
