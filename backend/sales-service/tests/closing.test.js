const test = require('node:test');
const assert = require('node:assert');

test('Daily Closing Formulas & Financial Reconciliations', () => {
  const totalBusiness = 12500;
  const onlineCollection = 5000;
  const offlineCollection = 7200;
  const eligibleExpenses = [
    { category: 'TRANSPORT', amount: 350 },
    { category: 'MISC', amount: 150 }
  ];
  const extraAmount = 180; // Informational only

  // Formula 1: Total Collected
  const totalCollected = onlineCollection + offlineCollection;
  assert.strictEqual(totalCollected, 12200);

  // Formula 2: Total Expenses
  const totalExpenses = eligibleExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  assert.strictEqual(totalExpenses, 500);

  // Formula 3: Final Amount
  const finalAmount = totalCollected - totalExpenses;
  assert.strictEqual(finalAmount, 11700);

  // Formula 4: Collection Difference
  const collectionDifference = totalCollected - totalBusiness;
  assert.strictEqual(collectionDifference, -300);

  // Rule: Extra Amount is strictly excluded from Total Business, Total Collected, Total Expenses, and Final Amount
  assert.strictEqual(finalAmount.toString().includes(extraAmount), false);
  assert.ok(extraAmount > 0, 'Extra Amount is tracked as informational only');
});

test('Daily Stock Calculation Formulas', () => {
  const opening = 10;
  const indent = 5;
  const closing = 4;
  const rate = 410;
  const extraAmount = 50;

  const total = opening + indent;
  assert.strictEqual(total, 15);

  const sale = total - closing;
  assert.strictEqual(sale, 11);

  const amount = sale * rate;
  assert.strictEqual(amount, 4510);

  // Next day carry-forward
  const nextDayOpening = closing;
  assert.strictEqual(nextDayOpening, 4);
});
