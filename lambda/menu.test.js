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

test('dayItems keeps calendar order and drops duplicates', () => {
  const byDay = { 16: [
    { name: 'B4L Pancake & Sausage' }, { name: 'Potato Puff Tots' }, { name: 'Protein Bento Box' },
    { name: 'Pineapple' }, { name: 'Daily Fruit Offering' }, { name: 'Pineapple' },
  ] };
  assert.deepEqual(m.dayItems(byDay, 16), ['Pancake and Sausage', 'Potato Puff Tots', 'Protein Bento Box', 'Pineapple', 'Daily Fruit Offering']);
  assert.deepEqual(m.dayItems(byDay, 9), []);
});

test('addDays crosses month and year', () => {
  assert.deepEqual(m.addDays({ year: 2026, month: 11, day: 31 }, 1), { year: 2027, month: 0, day: 1 });
});
