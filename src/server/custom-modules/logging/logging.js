const fs = require('fs');
const path = require('path');

const log4js = require('log4js');
const logger = log4js.getLogger();

const logFile = GetLogTimeStamp().replace(/\//g,'-').replace(/\:/g,'.') + '.log';
fs.writeFile(path.join(__dirname, '../../../../logs', logFile), '', (err) => {
  if (err) throw err
  logger.info(`Log file created: ${logFile}`);
});

log4js.configure({
  appenders: {
    out:{ type: 'console', layout: { type: 'pattern', pattern: "%d{dd/MM/yyyy hh:mm:ss} [%p] %m" } },
    app:{ type: 'file', filename: path.join(__dirname, '../../../../logs', logFile), layout: { type: 'pattern', pattern: "%d{dd/MM/yyyy hh:mm:ss} [%p] %m" } }
  },
  categories: {
    default: { appenders: [ 'out', 'app' ], level: 'debug' }
  },
  replaceConsole: false
});

module.exports = logger;

function GetLogTimeStamp() {
  let date = new Date();

  let hour = date.getHours();
  hour = (hour < 10 ? "0" : "") + hour;

  let min = date.getMinutes();
  min = (min < 10 ? "0" : "") + min;

  let sec = date.getSeconds();
  sec = (sec < 10 ? "0" : "") + sec;

  let year = date.getFullYear();

  let month = date.getMonth() + 1;
  month = (month < 10 ? "0" : "") + month;

  let day = date.getDate();
  day = (day < 10 ? "0" : "") + day;

  return day + "/" + month + "/" + year + " " + hour + ":" + min + ":" + sec;
}
