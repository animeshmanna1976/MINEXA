const jwt = require('jsonwebtoken');

const JWT_SECRET =
  process.env.JWT_SECRET || 'development-secret-change-me';

function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // Expected format:
    // Authorization: Bearer <token>
    if (!authHeader) {
      return res.status(401).json({
        status: 'error',
        message: 'Authorization header is required',
      });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid authorization format',
      });
    }

    const token = parts[1];

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    console.error('Authentication error:', error);

    return res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token',
    });
  }
}

module.exports = authenticateToken;