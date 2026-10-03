const test = require('node:test');
const assert = require('node:assert');

test('Invoice Number Generation Logic', () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const invoicePrefix = `INV-${dateStr}`;

  assert.ok(invoicePrefix.startsWith('INV-'));
  assert.strictEqual(invoicePrefix.length, 12);
});

test('Sales Total Calculation', () => {
  const items = [
    { serialNumber: 'RS10001', unitPrice: 150 },
    { serialNumber: 'RS10002', unitPrice: 150 },
    { serialNumber: 'RS10003', unitPrice: 150 }
  ];

  const total = items.reduce((acc, curr) => acc + curr.unitPrice, 0);
  assert.strictEqual(total, 450);
});
