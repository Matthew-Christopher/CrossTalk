"use strict";

const express = require('express');
const app = express();
const defaultPort = process.env.PORT || 80

const http = require('http');
const httpServer = http.createServer(app); // Running as localhost, we could implement SSL later.
//const https = require('https');

const path = require('path');

// CUSTOM MODULES
const log = require('./custom-modules/logging');
const chat = require('./custom-modules/chat').initialise(http);
// END CUSTOM MODULES

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname + '/../client/chat.html'));
});

app.use(express.static('../client', {
  extensions: ['html', 'htm']
}));

httpServer.listen(defaultPort, () => {
  log.info('node.js HTTP web server started on port ' + httpServer.address().port);
});
