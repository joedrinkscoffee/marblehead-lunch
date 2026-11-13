// Usage: node try.js [school] [YYYY-MM-DD]   e.g. node try.js brown 2026-11-13
const m = require('./menu');
const [school = 'brown', iso] = process.argv.slice(2);
const date = iso ? (([y, mo, d]) => ({ year: y, month: mo - 1, day: d }))(iso.split('-').map(Number)) : m.addDays(m.localDate(), 1);
m.lunchSpeech(m.resolveSchool(school), date).then(console.log, (e) => { console.error(e); process.exit(1); });
