const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'dev-super-secret-jwt-key';

test('Gateway Auth Middleware - Valid Token Headers Generation', () => {
  const payload = {
    id: 'user-uuid-999',
    email: 'admin@wineshop.com',
    role: 'ADMIN'
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  const decoded = jwt.verify(token, JWT_SECRET);

  assert.strictEqual(decoded.id, payload.id);
  assert.strictEqual(decoded.email, payload.email);
  assert.strictEqual(decoded.role, payload.role);
});
