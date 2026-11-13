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
  assert.equal(m.tidy('Bagel, yogurt w/Cream Cheese'), 'Bagel, yogurt with Cream Cheese');
});

test('groupDay keeps every item, grouped by category', () => {
  const byDay = { 4: [
    { name: '1% Milk', category: 'Milk' }, { name: 'Pizza, Cheese', category: 'Entrees' },
    { name: 'Pizza Bento Box', category: 'Entrees' }, { name: 'Apple Sauce', category: 'Fruit' },
    { name: '1% Milk', category: 'Milk' },
  ] };
  assert.deepEqual(m.groupDay(byDay, 4), [
    { label: 'Entrées', names: ['Cheese Pizza', 'Pizza Bento Box'] },
    { label: 'Fruit', names: ['Apple Sauce'] },
    { label: 'Milk', names: ['1% Milk'] },
  ]);
  assert.deepEqual(m.groupDay(byDay, 9), []);
});

test('addDays crosses month and year', () => {
  assert.deepEqual(m.addDays({ year: 2026, month: 11, day: 31 }, 1), { year: 2027, month: 0, day: 1 });
});
