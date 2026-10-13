const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { verifyGatewayToken } = require('../src/middleware/auth.middleware');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-super-secret-jwt-key';

test('Gateway Auth Middleware - Valid Token Headers Generation', () => {
  const payload = {
    id: 'user-uuid-999',
    email: 'admin@wineshop.com',
    role: 'ADMIN'
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  const req = {
    path: '/api/sales/export/csv',
    headers: {
      authorization: `Bearer ${token}`,
      'x-shop-id': 'SHOP1'
    }
  };
  const res = {
    status: (code) => ({ json: (data) => ({ code, data }) })
  };
  let nextCalled = false;
  verifyGatewayToken(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.headers['x-user-id'], payload.id);
  assert.strictEqual(req.headers['x-user-role'], payload.role);
  assert.strictEqual(req.headers['x-user-email'], payload.email);
});

test('Gateway Auth Middleware - Rejects missing Authorization header', () => {
  const req = {
    path: '/api/sales/export/csv',
    headers: {}
  };
  let responseCode = null;
  let responseData = null;
  const res = {
    status: (code) => {
      responseCode = code;
      return {
        json: (data) => {
          responseData = data;
        }
      };
    }
  };

  verifyGatewayToken(req, res, () => {});
  assert.strictEqual(responseCode, 401);
  assert.strictEqual(responseData.error, 'UNAUTHORIZED');
});

test('Gateway Auth Middleware - Rejects invalid or expired token', () => {
  const req = {
    path: '/api/inventory/daily-stock',
    headers: {
      authorization: 'Bearer bad-invalid-token'
    }
  };
  let responseCode = null;
  let responseData = null;
  const res = {
    status: (code) => {
      responseCode = code;
      return {
        json: (data) => {
          responseData = data;
        }
      };
    }
  };

  verifyGatewayToken(req, res, () => {});
  assert.strictEqual(responseCode, 403);
  assert.strictEqual(responseData.error, 'FORBIDDEN');
});
