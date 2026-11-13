// Single-file build of worker/worker.js (built with esbuild). Paste this into the Cloudflare dashboard editor.
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// lambda/menu.js
var require_menu = __commonJS({
  "lambda/menu.js"(exports, module) {
    var MENUTYPE_URL = "https://www.schoolnutritionandfitness.com/webmenus2/api/menutypeController.php/show";
    var GRAPHQL_URL = "https://api.schoolnutritionandfitness.com/graphql";
    var TZ = "America/New_York";
    var SCHOOLS = {
      brown: { name: "Brown School", menuTypeId: "6a19c2d297d2cf47b04af057" },
      glover: { name: "Glover School", menuTypeId: "6a19c2e4946229098343d050" },
      village: { name: "Village School", menuTypeId: "6a19c3503fb1be001f7b8cb9" },
      vets: { name: "Veterans Middle School", menuTypeId: "6a19c36fd5c334501c6a3cdc" },
      high: { name: "Marblehead High School", menuTypeId: "6a19c38e3d2a583c4a2c3552" }
    };
    var ALIASES = {
      brown: "brown",
      "brown school": "brown",
      "brown elementary": "brown",
      glover: "glover",
      "glover school": "glover",
      village: "village",
      "village school": "village",
      vets: "vets",
      veterans: "vets",
      "veterans middle": "vets",
      "veterans middle school": "vets",
      "middle school": "vets",
      high: "high",
      "high school": "high",
      "marblehead high": "high",
      "marblehead high school": "high"
    };
    function resolveSchool(spoken) {
      if (!spoken) return null;
      return ALIASES[spoken.toLowerCase().replace(/[^a-z ]/g, "").trim()] || null;
    }
    function localDate(now = /* @__PURE__ */ new Date()) {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now).map((x) => [x.type, x.value]));
      return { year: +p.year, month: +p.month - 1, day: +p.day };
    }
    function addDays({ year, month, day }, n) {
      const d = new Date(Date.UTC(year, month, day + n));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
    }
    function requestJson(url, { method = "GET", headers = {}, body } = {}) {
      if (typeof fetch === "function") {
        return fetch(url, { method, headers, body }).then((r) => {
          if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
          return r.json();
        });
      }
      const https = __require("https");
      return new Promise((resolve, reject) => {
        const req = https.request(url, { method, headers: body ? { ...headers, "Content-Length": Buffer.byteLength(body) } : headers }, (res) => {
          let data = "";
          res.setEncoding("utf8");
          res.on("data", (c) => {
            data += c;
          });
          res.on("end", () => {
            if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`${url} -> HTTP ${res.statusCode}`));
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        });
        req.setTimeout(6e3, () => req.destroy(new Error(`${url} timed out`)));
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
      });
    }
    var cache = /* @__PURE__ */ new Map();
    async function cached(key, ms, fn) {
      const hit = cache.get(key);
      if (hit && Date.now() - hit.t < ms) return hit.v;
      const v = await fn();
      cache.set(key, { t: Date.now(), v });
      return v;
    }
    async function getMenuId(menuTypeId, year, month) {
      const data = await cached(`mt:${menuTypeId}`, 60 * 60 * 1e3, () => requestJson(`${MENUTYPE_URL}?_id=${menuTypeId}`));
      const m = (data.menus || []).find((x) => +x.year === year && +x.month === month);
      return m ? m._id.$id : null;
    }
    async function getMonth(menuId) {
      return cached(`menu:${menuId}`, 60 * 60 * 1e3, async () => {
        const json = await requestJson(GRAPHQL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "https://www.schoolnutritionandfitness.com" },
          body: JSON.stringify({ query: `{ menu(id:"${menuId}") { items { day product { name category } } } }` })
        });
        const byDay = {};
        for (const it of json?.data?.menu?.items || []) {
          if (!it.product?.name) continue;
          (byDay[it.day] ||= []).push({ name: it.product.name.trim(), category: it.product.category });
        }
        return byDay;
      });
    }
    var CATEGORY_WORDS = { entrees: "Entr\xE9es", grain: "Grains", vegetable: "Vegetables", fruit: "Fruit", milk: "Milk" };
    var CATEGORY_ORDER = ["entrees", "grain", "vegetable", "fruit", "milk"];
    function groupDay(byDay, day) {
      const groups = /* @__PURE__ */ new Map();
      for (const i of byDay[day] || []) {
        const key = (i.category || "other").toLowerCase();
        if (!groups.has(key)) groups.set(key, []);
        const name = tidy(i.name);
        if (!groups.get(key).includes(name)) groups.get(key).push(name);
      }
      const rank = (k) => CATEGORY_ORDER.indexOf(k) + 1 || 99;
      return [...groups.entries()].sort((x, y) => rank(x[0]) - rank(y[0])).map(([k, names]) => ({ label: CATEGORY_WORDS[k] || "Also", names }));
    }
    function tidy(name) {
      let n = name.replace(/^B4L\s+/i, "").replace(/^Bfast\b/i, "Breakfast");
      const m = n.match(/^([^,]+),\s*([^,]+)$/);
      if (m && !/w\//.test(n)) n = `${m[2]} ${m[1]}`;
      if (n === n.toUpperCase()) n = n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
      return n.replace(/&/g, "and").replace(/\s*w\/\s*/gi, " with ").replace(/\s+/g, " ").trim();
    }
    function joinList(xs) {
      if (xs.length <= 1) return xs.join("");
      if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
      return `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`;
    }
    var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    function weekday(d) {
      return DAY_NAMES[new Date(Date.UTC(d.year, d.month, d.day)).getUTCDay()];
    }
    async function lunchSpeech(schoolKey, date, whenWord) {
      const school = SCHOOLS[schoolKey];
      const when = whenWord || `on ${weekday(date)}`;
      const menuId = await getMenuId(school.menuTypeId, date.year, date.month);
      if (!menuId) return `I couldn't find a ${school.name} lunch menu for that month yet.`;
      const byDay = await getMonth(menuId);
      const groups = groupDay(byDay, date.day);
      if (!groups.length) return `There's no lunch on the ${school.name} menu ${when}. It may be a weekend, holiday, or day off.`;
      return `Here's lunch at ${school.name} ${when}. ${groups.map((g) => `${g.label}: ${joinList(g.names)}.`).join(" ")}`;
    }
    function pickDate2(slotValue, now = /* @__PURE__ */ new Date()) {
      const today = localDate(now);
      if (slotValue && /^\d{4}-\d{2}-\d{2}$/.test(slotValue)) {
        const [y, m, d] = slotValue.split("-").map(Number);
        const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(today.year, today.month, today.day)) / 864e5);
        return { date: { year: y, month: m - 1, day: d }, word: diff === 0 ? "today" : diff === 1 ? "tomorrow" : void 0 };
      }
      const hour = +new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now);
      return hour < 13 ? { date: today, word: "today" } : { date: addDays(today, 1), word: "tomorrow" };
    }
    module.exports = { pickDate: pickDate2, SCHOOLS, resolveSchool, localDate, addDays, weekday, getMenuId, getMonth, groupDay, tidy, lunchSpeech };
  }
});

// worker/worker.js
var import_menu = __toESM(require_menu());

// worker/dates.js
var pickDate = (menu2, v) => menu2.pickDate(v);

// worker/worker.js
var ASK_SCHOOL = "Which school? Brown, Glover, Village, Vets, or the high school?";
function reply(text, { endSession = true, attributes = {} } = {}) {
  return Response.json({
    version: "1.0",
    sessionAttributes: attributes,
    response: {
      outputSpeech: { type: "PlainText", text },
      ...endSession ? { card: { type: "Simple", title: "School lunch", content: text } } : { reprompt: { outputSpeech: { type: "PlainText", text } } },
      shouldEndSession: endSession
    }
  });
}
async function lunch(env, req, attrs) {
  const slots = req.intent?.slots || {};
  const spokenDate = slots.date?.value || attrs.pendingDate;
  const school = import_menu.default.resolveSchool(slots.school?.value) || env.DEFAULT_SCHOOL || null;
  if (!school) return reply(ASK_SCHOOL, { endSession: false, attributes: { pendingDate: spokenDate } });
  const { date, word } = pickDate(import_menu.default, spokenDate);
  try {
    return reply(await import_menu.default.lunchSpeech(school, date, word));
  } catch (e) {
    console.error(e);
    return reply("Sorry, I couldn't reach the school lunch menu right now. Please try again in a bit.");
  }
}
var worker_default = {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("Marblehead Lunch skill endpoint", { status: 200 });
    const body = await request.json();
    const req = body.request || {};
    const attrs = body.session?.attributes || {};
    if (env.SKILL_ID && body.session?.application?.applicationId !== env.SKILL_ID) {
      return new Response("wrong skill", { status: 403 });
    }
    if (req.type === "LaunchRequest") return reply(`Marblehead school lunch. ${ASK_SCHOOL}`, { endSession: false });
    if (req.type === "IntentRequest") {
      const name = req.intent?.name;
      if (name === "GetLunchIntent") return lunch(env, req, attrs);
      if (name === "AMAZON.HelpIntent") return reply("You can ask what's for lunch at any Marblehead school, for example, what's for lunch at Glover tomorrow.", { endSession: false });
      return reply("Okay.");
    }
    return Response.json({ version: "1.0", response: { shouldEndSession: true } });
  }
};
export {
  worker_default as default
};
