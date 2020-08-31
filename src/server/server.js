const express = require('express');
const app = express();
const defaultPort = process.env.PORT || 80;
const bodyParser = require('body-parser')

const http = require('http');
//const https = require('https');

const path = require('path');

// CUSTOM MODULES
const account = require('./custom-modules/account');
const cryptography = require('./custom-modules/cryptography');
const log = require('./custom-modules/logging');
// END CUSTOM MODULES

app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname + '/../client/login.html'));
});

app.post('/authenticate-login', (req, res) => {
  account.LogIn(req.body.email, cryptography.Hash(req.body.password));
});

app.use(express.static('../client', {
  extensions: ['html', 'htm']
}));

const httpServer = http.createServer(app).listen(defaultPort, () => {
  log.info('node.js HTTP web server started on port ' + httpServer.address().port);
});
