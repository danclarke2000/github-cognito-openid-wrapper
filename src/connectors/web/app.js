const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');
const validateConfig = require('../../validate-config');

const PORT = MyConfig.PORT;
require('colors');

const app = express();

try {
    validateConfig().then( (value) => {
        logger.error(`app.js | validate-config ok`);
    }, (err) => {
        logger.error(`app.js | validate-config; promise error ${err}`);
    });
} catch (e) {
  console.error('Failed to start:'.red, e.message);
  console.error('  See the readme for configuration information');
  process.exit(1);
}
console.info('Config is valid'.cyan);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
routes(app);
app.listen(PORT);
console.info(`Listening on ${PORT}`.cyan);
