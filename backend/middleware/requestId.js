const { randomUUID } = require('crypto');

const createRequestId = () => {
  try {
    return randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};

const requestIdMiddleware = () => (req, res, next) => {
  const requestId = String(req.headers['x-request-id'] || '').trim() || createRequestId();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

module.exports = { requestIdMiddleware };

