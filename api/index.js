// Vercel Serverless entrypoint (root deployment).
// Delegates to the existing backend Express app.
module.exports = require('../backend/api/index.js');

