const test = require('node:test');
const assert = require('node:assert');
const m = require('./menu');

test('resolveSchool handles spoken variants', () => {
  assert.equal(m.resolveSchool('Brown School'), 'brown');
  assert.equal(m.resolveSchool('veterans middle school'), 'vets');
  assert.equal(m.resolveSchool('high school'), 'high');
  assert.equal(m.resolveSchool('nowhere'), null);
});

test('tidy makes names speakable', () => {
  assert.equal(m.tidy('Pizza, Cheese'), 'Cheese Pizza');
  assert.equal(m.tidy('B4L French Toast & Bacon'), 'French Toast and Bacon');
  assert.equal(m.tidy('CRANBERRY SAUCE'), 'Cranberry Sauce');
  assert.equal(m.tidy('Bagel, yogurt w/Cream Cheese'), 'Bagel and yogurt with Cream Cheese');
});

test('dayItems splits calendar items from always-available extras and drops drinks', () => {
  const byDay = { 16: [
    { name: 'Bagel, yogurt w/Cream Cheese', category: 'Entrees', always: true },
    { name: 'Turkey & Cheese Sandwich', category: 'Entrees', always: true },
    { name: 'B4L Pancake & Sausage', category: 'Entrees' }, { name: 'Potato Puff Tots', category: 'Vegetable' },
    { name: 'Pineapple', category: 'Fruit' }, { name: 'Pineapple', category: 'Fruit' },
    { name: '1% Milk', category: 'Milk', always: true }, { name: 'Choc Milk', category: 'Milk', always: true },
  ] };
  assert.deepEqual(m.dayItems(byDay, 16), {
    main: ['Pancake and Sausage', 'Potato Puff Tots', 'Pineapple'],
    always: ['Bagel and yogurt with Cream Cheese', 'Turkey and Cheese Sandwich'],
  });
  assert.deepEqual(m.dayItems(byDay, 9), { main: [], always: [] });
});

test('addDays crosses month and year', () => {
  assert.deepEqual(m.addDays({ year: 2026, month: 11, day: 31 }, 1), { year: 2027, month: 0, day: 1 });
});
