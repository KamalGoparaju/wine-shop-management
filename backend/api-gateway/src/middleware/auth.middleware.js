const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-super-secret-jwt-key';

const verifyGatewayToken = (req, res, next) => {
  // Public paths that do not require authentication
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/health',
    '/'
  ];

  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required',
      error: 'UNAUTHORIZED'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    
    // Inject user metadata headers for downstream microservices
    req.headers['x-user-id'] = decoded.id;
    req.headers['x-user-role'] = decoded.role;
    req.headers['x-user-email'] = decoded.email;

    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token',
      error: 'FORBIDDEN'
    });
  }
};

module.exports = { verifyGatewayToken };
