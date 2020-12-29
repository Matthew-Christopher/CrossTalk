"use strict";

const express = require('express');
const app = express();
const defaultPort = process.env.PORT || 80

const http = require('http').createServer(app); // Running as localhost, we could implement SSL later.
//const https = require('https');

const path = require('path');

// CUSTOM MODULES
const log = require('./custom-modules/logging');
const chat = require('./custom-modules/chat');
const AvailableGroup = require('./custom-modules/AvailableGroup.js');
// END CUSTOM MODULES

var demoServers = [
	new AvailableGroup("d58366", "Physics Group", "Hi guys."),
	new AvailableGroup("1b233c", "Maths Gang", "Cya later."),
	new AvailableGroup("0b51e7", "Computer Science Chat", "Here is my NEA chat app!")
];

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname + '/../client/chat.html'));
});

app.get('/api/GetMyGroups', (req, res) => {
	res.json(JSON.stringify(demoServers));
})

app.get('/')

app.use(express.static('../client', {
  extensions: ['html', 'htm']
}));

const httpServer = app.listen(defaultPort, () => {
	  log.info('node.js HTTP web server started on port ' + httpServer.address().port);
		chat.initialise(httpServer);
});
