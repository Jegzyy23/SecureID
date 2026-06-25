const serverless = require('serverless-http');
const { app, initApp } = require('../server');

let handler;

module.exports = async (req, res) => {
  try {
    if (!handler) {
      // initialize DB and routes once
      await initApp();
      handler = serverless(app);
    }
    return handler(req, res);
  } catch (err) {
    console.error('Initialization error:', err);
    res.statusCode = 500;
    res.end('Initialization error');
  }
};
