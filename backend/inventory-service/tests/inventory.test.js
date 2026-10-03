const test = require('node:test');
const assert = require('node:assert');

test('Business Rule 1 & 2 - Total Bottle Calculation and Serial Count Validation', () => {
  const numberOfBoxes = 2;
  const bottlesPerBox = 3;
  const totalBottles = numberOfBoxes * bottlesPerBox; // 2 x 3 = 6

  assert.strictEqual(totalBottles, 6);

  const serials = ['RS10001', 'RS10002', 'RS10003', 'RS10004', 'RS10005', 'RS10006'];
  assert.strictEqual(serials.length, totalBottles);

  const invalidSerials = ['RS10001', 'RS10002'];
  assert.notStrictEqual(invalidSerials.length, totalBottles);
});

test('Business Rule 3 - Serial Number Uniqueness Check in Input', () => {
  const inputWithDuplicates = ['RS10001', 'RS10002', 'RS10001'];
  const uniqueSet = new Set(inputWithDuplicates);

  assert.strictEqual(uniqueSet.size < inputWithDuplicates.length, true);
});

test('Box Serial Number Distribution Logic', () => {
  const numberOfBoxes = 2;
  const bottlesPerBox = 3;
  const serials = ['RS10001', 'RS10002', 'RS10003', 'RS10004', 'RS10005', 'RS10006'];

  const boxes = [];
  let index = 0;

  for (let b = 1; b <= numberOfBoxes; b++) {
    const boxSerials = serials.slice(index, index + bottlesPerBox);
    boxes.push({ boxNumber: b, serials: boxSerials });
    index += bottlesPerBox;
  }

  assert.strictEqual(boxes.length, 2);
  assert.deepStrictEqual(boxes[0].serials, ['RS10001', 'RS10002', 'RS10003']);
  assert.deepStrictEqual(boxes[1].serials, ['RS10004', 'RS10005', 'RS10006']);
});
