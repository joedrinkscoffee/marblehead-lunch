// Alexa skill entry point: "Alexa, ask Marblehead Lunch what's for lunch at <school> tomorrow"
const Alexa = require('ask-sdk-core');
const menu = require('./menu');

// Optional: set DEFAULT_SCHOOL (brown, glover, village, vets, high) to skip the "which school?" question.
const DEFAULT_SCHOOL = process.env.DEFAULT_SCHOOL || null;
const ASK_SCHOOL = 'Which school? Brown, Glover, Village, Vets, or the high school?';

function pickDate(slotValue) {
  const today = menu.localDate();
  if (slotValue && /^\d{4}-\d{2}-\d{2}$/.test(slotValue)) {
    const [y, m, d] = slotValue.split('-').map(Number);
    const date = { year: y, month: m - 1, day: d };
    const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(today.year, today.month, today.day)) / 86400000);
    return { date, word: diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : undefined };
  }
  // No date said: before 1 PM answer for today, after that for tomorrow.
  const hour = +new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(new Date());
  return hour < 13 ? { date: today, word: 'today' } : { date: menu.addDays(today, 1), word: 'tomorrow' };
}

const LunchIntentHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
    && Alexa.getIntentName(h.requestEnvelope) === 'GetLunchIntent',
  async handle(h) {
    const attrs = h.attributesManager.getSessionAttributes();
    const spokenSchool = Alexa.getSlotValue(h.requestEnvelope, 'school');
    const spokenDate = Alexa.getSlotValue(h.requestEnvelope, 'date') || attrs.pendingDate;
    const schoolKey = menu.resolveSchool(spokenSchool) || DEFAULT_SCHOOL;
    if (!schoolKey) {
      // Remember the day they asked about, then ask which school.
      h.attributesManager.setSessionAttributes({ pendingDate: spokenDate });
      return h.responseBuilder.speak(ASK_SCHOOL).reprompt(ASK_SCHOOL).getResponse();
    }
    h.attributesManager.setSessionAttributes({});
    const { date, word } = pickDate(spokenDate);
    let speech;
    try {
      speech = await menu.lunchSpeech(schoolKey, date, word);
    } catch (e) {
      console.error(e);
      speech = "Sorry, I couldn't reach the school lunch menu right now. Please try again in a bit.";
    }
    return h.responseBuilder.speak(speech).withSimpleCard('School lunch', speech).getResponse();
  },
};

const LaunchHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
  handle: (h) => h.responseBuilder
    .speak(`Marblehead school lunch. ${ASK_SCHOOL}`).reprompt(ASK_SCHOOL).getResponse(),
};

const HelpHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
    && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.HelpIntent',
  handle: (h) => h.responseBuilder
    .speak("You can ask what's for lunch at any Marblehead school, for example, what's for lunch at Glover tomorrow. The schools are Brown, Glover, Village, Vets, and the high school.")
    .reprompt('Which school?').getResponse(),
};

const StopHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest'
    || (Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
      && ['AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.FallbackIntent'].includes(Alexa.getIntentName(h.requestEnvelope))),
  handle: (h) => h.responseBuilder.speak('Okay.').getResponse(),
};

const ErrorHandler = {
  canHandle: () => true,
  handle: (h, e) => { console.error(e); return h.responseBuilder.speak('Sorry, something went wrong.').getResponse(); },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(LunchIntentHandler, LaunchHandler, HelpHandler, StopHandler)
  .addErrorHandlers(ErrorHandler)
  .lambda();
exports.pickDate = pickDate;
