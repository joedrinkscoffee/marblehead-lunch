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

const cache = new Map();
async function cached(key, ms, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ms) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

async function getMenuId(menuTypeId, year, month) {
  const data = await cached(`mt:${menuTypeId}`, 60 * 60 * 1000, async () => {
    const r = await fetch(`${MENUTYPE_URL}?_id=${menuTypeId}`);
    if (!r.ok) throw new Error(`menutype ${r.status}`);
    return r.json();
  });
  const m = (data.menus || []).find((x) => +x.year === year && +x.month === month);
  return m ? m._id.$id : null;
}

// Returns { [dayOfMonth]: [{ name, category }] }
async function getMonth(menuId) {
  return cached(`menu:${menuId}`, 60 * 60 * 1000, async () => {
    const r = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://www.schoolnutritionandfitness.com' },
      body: JSON.stringify({ query: `{ menu(id:"${menuId}") { items { day product { name category } } } }` }),
    });
    if (!r.ok) throw new Error(`graphql ${r.status}`);
    const json = await r.json();
    const byDay = {};
    for (const it of json?.data?.menu?.items || []) {
      if (!it.product?.name) continue;
      (byDay[it.day] ||= []).push({ name: it.product.name.trim(), category: it.product.category });
    }
    return byDay;
  });
}

// Group a day's full menu by category, in the order the menu lists categories.
const CATEGORY_WORDS = { entrees: 'Entrées', grain: 'Grains', vegetable: 'Vegetables', fruit: 'Fruit', milk: 'Milk' };
const CATEGORY_ORDER = ['entrees', 'grain', 'vegetable', 'fruit', 'milk'];
function groupDay(byDay, day) {
  const groups = new Map();
  for (const i of byDay[day] || []) {
    const key = (i.category || 'other').toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    const name = tidy(i.name);
    if (!groups.get(key).includes(name)) groups.get(key).push(name);
  }
  const rank = (k) => (CATEGORY_ORDER.indexOf(k) + 1) || 99;
  return [...groups.entries()].sort((x, y) => rank(x[0]) - rank(y[0]))
    .map(([k, names]) => ({ label: CATEGORY_WORDS[k] || 'Also', names }));
}

function tidy(name) {
  // "Pizza, Cheese" -> "Cheese Pizza"; drop vendor prefixes like "B4L ".
  let n = name.replace(/^B4L\s+/i, '').replace(/^Bfast\b/i, 'Breakfast');
  const m = n.match(/^([^,]+),\s*([^,]+)$/);
  if (m && !/w\//.test(n)) n = `${m[2]} ${m[1]}`;
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
async function lunchSpeech(schoolKey, date, whenWord) {
  const school = SCHOOLS[schoolKey];
  const when = whenWord || `on ${weekday(date)}`;
  const menuId = await getMenuId(school.menuTypeId, date.year, date.month);
  if (!menuId) return `I couldn't find a ${school.name} lunch menu for that month yet.`;
  const byDay = await getMonth(menuId);
  const groups = groupDay(byDay, date.day);
  if (!groups.length) return `There's no lunch on the ${school.name} menu ${when}. It may be a weekend, holiday, or day off.`;
  return `Here's lunch at ${school.name} ${when}. ${groups.map((g) => `${g.label}: ${joinList(g.names)}.`).join(' ')}`;
}

module.exports = { SCHOOLS, resolveSchool, localDate, addDays, weekday, getMenuId, getMonth, groupDay, tidy, lunchSpeech };
