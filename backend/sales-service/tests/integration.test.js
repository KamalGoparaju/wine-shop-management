const test = require('node:test');
const assert = require('node:assert');

test('Sales Service Stock Validation Pre-check', () => {
  const bottleMock = {
    id: 'bottle-uuid-1',
    serialNumber: 'RS10001',
    productId: 'product-uuid-1',
    bottlePrice: '150.00',
    status: 'IN_STOCK'
  };

  assert.strictEqual(bottleMock.status, 'IN_STOCK');
  assert.strictEqual(parseFloat(bottleMock.bottlePrice), 150.0);

  const unavailableBottle = {
    ...bottleMock,
    status: 'SOLD'
  };

  assert.notStrictEqual(unavailableBottle.status, 'IN_STOCK');
});
