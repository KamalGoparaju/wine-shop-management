const test = require('node:test');
const assert = require('node:assert');
const { generateToken, verifyToken } = require('../src/utils/token');

test('Token Utility - Generate and Verify Token', () => {
  const payload = {
    id: 'user-uuid-123',
    email: 'admin@wineshop.com',
    name: 'Admin User',
    role: 'ADMIN'
  };

  const token = generateToken(payload);
  assert.strictEqual(typeof token, 'string');
  assert.ok(token.length > 0);

  const decoded = verifyToken(token);
  assert.strictEqual(decoded.id, payload.id);
  assert.strictEqual(decoded.email, payload.email);
  assert.strictEqual(decoded.role, payload.role);
});

test('Token Utility - Invalid Token Handling', () => {
  assert.throws(() => {
    verifyToken('invalid.token.value');
  });
});
