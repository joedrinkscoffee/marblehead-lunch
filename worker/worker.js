// Cloudflare Worker version of the skill backend, for when Alexa-hosted deploys aren't possible.
// In the Alexa console: Build > Endpoint > HTTPS, paste the Worker URL, and pick
// "My development endpoint is a sub-domain of a domain that has a wildcard certificate".
import menu from '../lambda/menu.js';
import { pickDate } from './dates.js';

const ASK_SCHOOL = 'Which school? Brown, Glover, Village, Vets, or the high school?';

function reply(text, { endSession = true, attributes = {} } = {}) {
  return Response.json({
    version: '1.0',
    sessionAttributes: attributes,
    response: {
      outputSpeech: { type: 'PlainText', text },
      ...(endSession ? { card: { type: 'Simple', title: 'School lunch', content: text } } : { reprompt: { outputSpeech: { type: 'PlainText', text } } }),
      shouldEndSession: endSession,
    },
  });
}

async function lunch(env, req, attrs) {
  const slots = req.intent?.slots || {};
  const spokenDate = slots.date?.value || attrs.pendingDate;
  const school = menu.resolveSchool(slots.school?.value) || env.DEFAULT_SCHOOL || null;
  if (!school) return reply(ASK_SCHOOL, { endSession: false, attributes: { pendingDate: spokenDate } });
  const { date, word } = pickDate(menu, spokenDate);
  try {
    return reply(await menu.lunchSpeech(school, date, word));
  } catch (e) {
    console.error(e);
    return reply("Sorry, I couldn't reach the school lunch menu right now. Please try again in a bit.");
  }
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Marblehead Lunch skill endpoint', { status: 200 });
    const body = await request.json();
    const req = body.request || {};
    const attrs = body.session?.attributes || {};
    if (env.SKILL_ID && body.session?.application?.applicationId !== env.SKILL_ID) {
      return new Response('wrong skill', { status: 403 });
    }
    if (req.type === 'LaunchRequest') return reply(`Marblehead school lunch. ${ASK_SCHOOL}`, { endSession: false });
    if (req.type === 'IntentRequest') {
      const name = req.intent?.name;
      if (name === 'GetLunchIntent') return lunch(env, req, attrs);
      if (name === 'AMAZON.HelpIntent') return reply("You can ask what's for lunch at any Marblehead school, for example, what's for lunch at Glover tomorrow.", { endSession: false });
      return reply('Okay.');
    }
    return Response.json({ version: '1.0', response: { shouldEndSession: true } });
  },
};
