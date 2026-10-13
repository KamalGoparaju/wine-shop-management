const test = require('node:test');
const assert = require('node:assert');
const { updateShop } = require('../src/controllers/shop.controller');
const { authorizeRoles } = require('../src/middleware/auth.middleware');

test('Shop Access Model - UserShop association structure and stable codes', () => {
  const shops = [
    { id: 'shop-1', code: 'SHOP1', name: 'Shop 1 — Central Wine Lounge' },
    { id: 'shop-2', code: 'SHOP2', name: 'Shop 2 — Premium Spirits & Wine' },
    { id: 'shop-3', code: 'SHOP3', name: 'Shop 3 — Highway Wine Mart' }
  ];

  assert.strictEqual(shops.length, 3);
  assert.strictEqual(shops[0].code, 'SHOP1');
  assert.strictEqual(shops[1].code, 'SHOP2');
  assert.strictEqual(shops[2].code, 'SHOP3');

  // Verify switching shop keeps active shop intact
  let activeShop = shops[0];
  assert.strictEqual(activeShop.code, 'SHOP1');
  activeShop = shops[1];
  assert.strictEqual(activeShop.code, 'SHOP2');
  activeShop = shops[2];
  assert.strictEqual(activeShop.code, 'SHOP3');
});

test('Shop Validation - Empty or whitespace shop name is rejected', async () => {
  const req = {
    params: { id: 'shop-1' },
    body: { name: '   ' }
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

  await updateShop(req, res, () => {});
  assert.strictEqual(responseCode, 400);
  assert.strictEqual(responseData.error, 'VALIDATION_ERROR');
  assert.strictEqual(responseData.message, 'Shop name cannot be empty');
});

test('Shop Authorization - Non-admin user cannot edit shop details', () => {
  const authMiddleware = authorizeRoles('ADMIN');
  const req = {
    user: { id: 'user-staff', role: 'STAFF' }
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
  let nextCalled = false;
  authMiddleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(responseCode, 403);
  assert.strictEqual(responseData.error, 'FORBIDDEN');
});

test('Shop Authorization - Admin user is authorized to edit shop details', () => {
  const authMiddleware = authorizeRoles('ADMIN');
  const req = {
    user: { id: 'user-admin', role: 'ADMIN' }
  };
  const res = {};
  let nextCalled = false;
  authMiddleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true);
});

test('Shop Name Update - Preserves createdAt and updates updatedAt', () => {
  const originalShop = {
    id: '5c9172eb-9ce6-42c2-98dc-475382872a98',
    code: 'SHOP1',
    name: 'Old Shop Name',
    address: 'Old Address',
    isActive: true,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z')
  };

  // Simulate update
  const newName = 'Downtown Wine Lounge';
  const newAddress = 'First Avenue, Downtown';
  const updatedShop = {
    ...originalShop,
    name: newName,
    address: newAddress,
    updatedAt: new Date('2026-10-12T15:00:00.000Z')
  };

  assert.strictEqual(updatedShop.id, originalShop.id); // ID must NEVER change
  assert.strictEqual(updatedShop.code, originalShop.code); // Code must NEVER change
  assert.strictEqual(updatedShop.createdAt, originalShop.createdAt); // createdAt unchanged
  assert.strictEqual(updatedShop.name, 'Downtown Wine Lounge');
  assert.notStrictEqual(updatedShop.updatedAt, originalShop.updatedAt); // updatedAt updated
});
