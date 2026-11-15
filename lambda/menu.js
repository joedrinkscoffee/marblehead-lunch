// Fetches Marblehead school lunch menus from schoolnutritionandfitness.com (webmenus2)
// and turns a day's menu into a short spoken sentence.

const MENUTYPE_URL = 'https://www.schoolnutritionandfitness.com/webmenus2/api/menutypeController.php/show';
const GRAPHQL_URL = 'https://api.schoolnutritionandfitness.com/graphql';
const TZ = 'America/New_York';

// Stable per-school lunch "menu type" ids (found via menuController.php/open on each school's menu link).
const SCHOOLS = {
  brown: { name: 'Brown School', menuTypeId: '6a19c2d297d2cf47b04af057' },
  glover: { name: 'Glover School', menuTypeId: '6a19c2e4946229098343d050' },
  village: { name: 'Village School', menuTypeId: '6a19c3503fb1be001f7b8cb9' },
  vets: { name: 'Veterans Middle School', menuTypeId: '6a19c36fd5c334501c6a3cdc' },
  high: { name: 'Marblehead High School', menuTypeId: '6a19c38e3d2a583c4a2c3552' },
};

const ALIASES = {
  brown: 'brown', 'brown school': 'brown', 'brown elementary': 'brown',
  glover: 'glover', 'glover school': 'glover',
  village: 'village', 'village school': 'village',
  vets: 'vets', veterans: 'vets', 'veterans middle': 'vets', 'veterans middle school': 'vets', 'middle school': 'vets',
  high: 'high', 'high school': 'high', 'marblehead high': 'high', 'marblehead high school': 'high',
};

function resolveSchool(spoken) {
  if (!spoken) return null;
  return ALIASES[spoken.toLowerCase().replace(/[^a-z ]/g, '').trim()] || null;
}

// Today's date parts in Marblehead's time zone.
function localDate(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(now).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month - 1, day: +p.day }; // month is 0-based, like the API
}

function addDays({ year, month, day }, n) {
  const d = new Date(Date.UTC(year, month, day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

// JSON over HTTPS. Uses global fetch when present (Node 18+, Workers); falls back to the
// https module on Node 16, which Alexa-hosted skills run on.
function requestJson(url, { method = 'GET', headers = {}, body } = {}) {
  if (typeof fetch === 'function') {
    return fetch(url, { method, headers, body }).then((r) => {
      if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
      return r.json();
    });
  }
  const https = require('https');
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers: body ? { ...headers, 'Content-Length': Buffer.byteLength(body) } : headers }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`${url} -> HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.setTimeout(6000, () => req.destroy(new Error(`${url} timed out`)));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const cache = new Map();
async function cached(key, ms, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ms) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

async function getMenuId(menuTypeId, year, month) {
  const data = await cached(`mt:${menuTypeId}`, 60 * 60 * 1000, () => requestJson(`${MENUTYPE_URL}?_id=${menuTypeId}`));
  const m = (data.menus || []).find((x) => +x.year === year && +x.month === month);
  return m ? m._id.$id : null;
}

// Returns { [dayOfMonth]: [{ name, category }] }
async function getMonth(menuId) {
  return cached(`menu:${menuId}`, 60 * 60 * 1000, async () => {
    const json = await requestJson(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://www.schoolnutritionandfitness.com' },
      body: JSON.stringify({ query: `{ menu(id:"${menuId}") { items { day product { name category hide_on_calendars } } } }` }),
    });
    const byDay = {};
    for (const it of json?.data?.menu?.items || []) {
      if (!it.product?.name) continue;
      // Items flagged hide_on_calendars (milk, bagel, sun butter, daily sandwiches...) are
      // always-available options that the published calendar doesn't show.
      (byDay[it.day] ||= []).push({
        name: it.product.name.trim(),
        category: it.product.category,
        always: String(it.product.hide_on_calendars) === '1',
      });
    }
    return byDay;
  });
}

const isDrink = (i) => /^milk$/i.test(i.category || '') || /\b(milk|juice|water)\b/i.test(i.name);

// Splits a day into the calendar's lunch items (in calendar order) and the
// always-available extras, de-duplicated. Drinks are left out of the extras.
function dayItems(byDay, day) {
  const main = [];
  const always = [];
  for (const i of byDay[day] || []) {
    const list = i.always ? always : main;
    if (i.always && isDrink(i)) continue;
    const name = tidy(i.name);
    if (!list.includes(name)) list.push(name);
  }
  return { main, always };
}

function tidy(name) {
  // "Pizza, Cheese" -> "Cheese Pizza"; drop vendor prefixes like "B4L ".
  let n = name.replace(/^B4L\s+/i, '').replace(/^Bfast\b/i, 'Breakfast');
  const m = n.match(/^([^,]+),\s*([^,]+)$/);
  if (m && !/w\//.test(n)) n = `${m[2]} ${m[1]}`;
  else n = n.replace(/,\s*/g, ' and '); // commas would break up the spoken list
  if (n === n.toUpperCase()) n = n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return n.replace(/&/g, 'and').replace(/\s*w\/\s*/gi, ' with ').replace(/\s+/g, ' ').trim();
}

function joinList(xs) {
  if (xs.length <= 1) return xs.join('');
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function weekday(d) { return DAY_NAMES[new Date(Date.UTC(d.year, d.month, d.day)).getUTCDay()]; }

// whenWord: "today" | "tomorrow" | undefined (then we use the weekday name)
// Returns { speech, always }: speech is the day's lunch, always is the spoken
// always-available sentence (or null) for a follow-up question.
async function lunchReport(schoolKey, date, whenWord) {
  const school = SCHOOLS[schoolKey];
  const when = whenWord || `on ${weekday(date)}`;
  const menuId = await getMenuId(school.menuTypeId, date.year, date.month);
  if (!menuId) return { speech: `I couldn't find a ${school.name} lunch menu for that month yet.`, always: null };
  const byDay = await getMonth(menuId);
  const { main, always } = dayItems(byDay, date.day);
  if (!main.length) return { speech: `There's no lunch on the ${school.name} menu ${when}. It may be a weekend, holiday, or day off.`, always: null };
  return {
    speech: `Lunch at ${school.name} ${when} is ${joinList(main)}.`,
    always: always.length ? `The always-available items are ${joinList(always)}.` : null,
  };
}

async function lunchSpeech(schoolKey, date, whenWord) {
  const r = await lunchReport(schoolKey, date, whenWord);
  return r.always ? `${r.speech} ${r.always}` : r.speech;
}

// Turn Alexa's AMAZON.DATE value into a date, plus "today"/"tomorrow" when it fits.
// No date said: before 1 PM answer for today, after that for tomorrow.
function pickDate(slotValue, now = new Date()) {
  const today = localDate(now);
  if (slotValue && /^\d{4}-\d{2}-\d{2}$/.test(slotValue)) {
    const [y, m, d] = slotValue.split('-').map(Number);
    const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(today.year, today.month, today.day)) / 86400000);
    return { date: { year: y, month: m - 1, day: d }, word: diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : undefined };
  }
  const hour = +new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(now);
  return hour < 13 ? { date: today, word: 'today' } : { date: addDays(today, 1), word: 'tomorrow' };
}

module.exports = { pickDate, lunchReport, ASK_ALWAYS: 'Do you want to hear the always-available items?', SCHOOLS, resolveSchool, localDate, addDays, weekday, getMenuId, getMonth, dayItems, tidy, lunchSpeech };
