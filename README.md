# Marblehead Lunch (Alexa skill)

Answers "What's for school lunch in Marblehead?" for any of the five Marblehead public schools (Brown, Glover, Village, Veterans Middle, and the High School), using the live menus on schoolnutritionandfitness.com.

Ask for a school and a day, for example "what's for lunch at Glover tomorrow". If you don't name a school, Alexa asks which one.

## How it gets the menu
1. Each school's lunch menu has a permanent **menu type** id (in `lambda/menu.js`).
2. `menutypeController.php/show?_id=<menuType>` lists that school's monthly menus; we pick the current month.
3. A GraphQL call to `api.schoolnutritionandfitness.com/graphql` returns that month's items by day.
4. Alexa reads the day's full menu, grouped as Entrées, Vegetables, Fruit, and Milk.

## Set it up (about 15 minutes, free)
1. Sign in at https://developer.amazon.com/alexa/console/ask with the **same Amazon account your Echo uses**.
2. **Create Skill**, name it "Marblehead Lunch", choose **Other > Custom > Alexa-hosted (Node.js)**, region US East, template "Start from scratch".
3. **Build > Interaction Model > JSON Editor**: paste `skill-package/interactionModels/custom/en-US.json`, then **Save** and **Build skill**.
4. **Code** tab: replace `index.js` and `package.json` with the files in `lambda/`, add a new file `menu.js` with the one in `lambda/`, then **Deploy**.
5. **Test** tab: set testing to "Development" and type "ask marblehead lunch what's for lunch at glover tomorrow".

Development skills work right away on every Echo on that Amazon account. No publishing needed for your household.

## Saying it naturally
Custom skills need their name in the phrase: "Alexa, ask Marblehead Lunch what's for lunch at Village tomorrow." To shorten that for your own household, make an Alexa app **Routine**: for example, when you say "what's for lunch tomorrow", the action is **Customized > "ask marblehead lunch what's for lunch at village tomorrow"** (use your own kids' school).

## Options
- If no school is said, Alexa asks which one. (Optional: set env var `DEFAULT_SCHOOL` to `brown`, `glover`, `village`, `vets`, or `high` to skip that question.)
- If no day is said, it answers for today before 1 PM and for tomorrow after.

## Try it locally
```
cd lambda && npm install && npm test
node try.js glover 2026-11-13
```
(In a proxied sandbox, prefix with `NODE_USE_ENV_PROXY=1`.)
