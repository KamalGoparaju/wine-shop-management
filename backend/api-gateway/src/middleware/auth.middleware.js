const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-super-secret-jwt-key';

const verifyGatewayToken = (req, res, next) => {
  // Public paths that do not require authentication
  const isPublic = 
    req.path === '/' || 
    req.path === '/health' ||
    req.path.startsWith('/api/auth/login') ||
    req.path.startsWith('/api/auth/register');

  if (isPublic) {
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
    if (req.headers['x-shop-id']) {
      req.headers['x-shop-id'] = String(req.headers['x-shop-id']).trim();
    }

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
