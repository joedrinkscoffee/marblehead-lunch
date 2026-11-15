// Alexa skill entry point: "Alexa, ask Marblehead Lunch what's for lunch at <school> tomorrow"
const Alexa = require('ask-sdk-core');
const menu = require('./menu');

// Optional: set DEFAULT_SCHOOL (brown, glover, village, vets, high) to skip the "which school?" question.
const DEFAULT_SCHOOL = process.env.DEFAULT_SCHOOL || null;
const ASK_SCHOOL = 'Which school? Brown, Glover, Village, Vets, or the high school?';

const pickDate = (v) => menu.pickDate(v);

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
    let report;
    try {
      report = await menu.lunchReport(schoolKey, date, word);
    } catch (e) {
      console.error(e);
      const speech = "Sorry, I couldn't reach the school lunch menu right now. Please try again in a bit.";
      return h.responseBuilder.speak(speech).getResponse();
    }
    if (!report.always) {
      return h.responseBuilder.speak(report.speech).withSimpleCard('School lunch', report.speech).getResponse();
    }
    // Offer the always-available items as a follow-up; keep the session open for yes or no.
    h.attributesManager.setSessionAttributes({ pendingAlways: report.always });
    return h.responseBuilder
      .speak(`${report.speech} ${menu.ASK_ALWAYS}`)
      .reprompt(menu.ASK_ALWAYS)
      .withSimpleCard('School lunch', `${report.speech}\n\n${report.always}`)
      .getResponse();
  },
};

const isIntent = (h, name) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
  && Alexa.getIntentName(h.requestEnvelope) === name;

const YesHandler = {
  canHandle: (h) => isIntent(h, 'AMAZON.YesIntent'),
  handle: (h) => {
    const { pendingAlways } = h.attributesManager.getSessionAttributes();
    h.attributesManager.setSessionAttributes({});
    if (!pendingAlways) return HelpHandler.handle(h);
    return h.responseBuilder.speak(pendingAlways).getResponse();
  },
};

const NoHandler = {
  canHandle: (h) => isIntent(h, 'AMAZON.NoIntent'),
  handle: (h) => {
    h.attributesManager.setSessionAttributes({});
    return h.responseBuilder.speak('Okay. Enjoy lunch!').getResponse();
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
  .addRequestHandlers(LunchIntentHandler, YesHandler, NoHandler, LaunchHandler, HelpHandler, StopHandler)
  .addErrorHandlers(ErrorHandler)
  .lambda();
exports.pickDate = pickDate;
