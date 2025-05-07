// scraper.js
// deps: npm i axios cheerio dotenv
require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const BASE = "https://events.purdue.edu";
const LIST = BASE + "/";
const STUDENT_URL =
  "https://events.purdue.edu/calendar/upcoming?event_types[]=39925425488556";
const FACULTY_URL =
  // "https://events.purdue.edu/calendar/day?event_types[]=39925426947703";
  "https://events.purdue.edu/calendar/week?card_size=small&order=date&experience=&event_types%5B%5D=39925426947703"

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const absolute = (src) =>
  src?.startsWith("http") ? src : src ? BASE + src : null;

function extractDates($detail) {
  // primary date
  const primary = $detail("div.em-list_dates__container p.em-date")
    .first()
    .text()
    .trim();

  // "Additional Event Dates:" => aria‑label on .em-list_dates__extra-message
  const extraMsg =
    $detail("div.em-list_dates__extra-message").attr("aria-label") || "";
  const extraClean = extraMsg
    .replace(/^(Additional (Event )?Dates:)\s*/i, "")
    .trim();

  return extraClean ? `${primary}; ${extraClean}` : primary;
}

// ─────────────────────────────────────────────────────────────
// 1) Scrape list page
// ─────────────────────────────────────────────────────────────
async function fetchPurdueEvents(url, audience) {
  const listHtml = await axios.get(url).then((r) => r.data);
  const $ = cheerio.load(listHtml);
  const events = [];

  $(".em-card").each((_, el) => {
    const $el = $(el);
    const linkRel = $el.find(".em-card_title a").attr("href") || "";

    const ev = {
      title: $el.find(".em-card_title").text().trim(),
      date: $el.find(".em-card_event-text").first().text().trim(), // might be ""
      location: $el.find(".em-card_event-text a").text().trim() || null,
      link: absolute(linkRel),
      image: absolute($el.find("img").attr("src")),
      description: null, // will be filled later
      audience, // 👈 attach label here
    };

    if (ev.title) events.push(ev);
  });

  return events;
}

async function fetchStudentEvents() {
  return fetchPurdueEvents(STUDENT_URL, "student");
}

async function fetchFacultyEvents() {
  return fetchPurdueEvents(FACULTY_URL, "faculty");
}

// ─────────────────────────────────────────────────────────────
// 2) Fetch every detail page in parallel
// ─────────────────────────────────────────────────────────────
async function enrichEventsWithDetails(events) {
  return Promise.all(
    events.map(async (ev) => {
      try {
        const html = await axios
          .get(ev.link, { timeout: 15000 })
          .then((r) => r.data);
        const $d = cheerio.load(html);

        // robust date extraction
        const fullDate = extractDates($d);
        ev.date = fullDate || ev.date || null;

        // long description (paragraphs joined by \n\n)
        const desc = $d("div.em-about_description p")
          .map((_, p) => $d(p).text().trim())
          .get()
          .filter(Boolean)
          .join("\n\n");
        ev.description = desc || ev.description || null;
      } catch (err) {
        console.warn("⚠️ detail fetch failed:", ev.title, err.message);
      }
      return ev;
    })
  );
}

//------------------------------------------------------------------
//  GPT formatting logic  (mirrors the Python prompt)
//------------------------------------------------------------------
const { OpenAI } = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}); // grabs key from env

const OPENAI_MODEL = "gpt-4o-mini";
const BATCH_SIZE = 10; // same as Python

async function formatEventsWithOpenAI(events) {
  if (!events.length) return [];

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const prompt = `
You are an event data formatter. You will receive a list of university events. Each event has a combined 'date' field (which might represent multiple dates or a range, possibly joined by ';') and may optionally include a 'description'.

Today's date is: ${today}

Your task is to process the following JSON input array:
- For each event:
  - Parse the original 'date' field into these new fields:
    - 'parsed_date': Represent ONLY the primary/first date found (e.g., "Mon, May 5, 2025"). Standardize simple relative dates like "Today" or "Tomorrow" to their actual date based on today's date (${today}). If the input combines multiple dates (e.g. separated by ';'), only use the first date. If unparseable, use null.
    - 'additional_days': If the event spans multiple days or has multiple dates, calculate the total number of additional days beyond the first day. For example, if an event runs May 5-7, this would be 2 (for the 2 days after the first). If there's only one day, set this to 0.
    - 'time': extract the time portion (e.g., "3 pm to 4 pm", "10:00 AM - 11:00 AM") or use null if no time is present in the original 'date' field or if multiple times are listed ambiguously.
  - Process the 'description' field (if present and not null/empty):
    - Create a new field 'short_description' containing a concise summary (1‑2 sentences) of the original 'description'. Focus on the core activity or purpose.
    - If the original 'description' is null or empty, set 'short_description' to null.
  - Keep the original fields: title, location, link, image, description.
  - Add new fields:
    - 'category': Guess a relevant category from the title and description ("Social", "Campus"). Use "Other" if unsure.
    - 'ranking': After building all objects, sort by urgency (high→medium→low) & importance, then assign 'ranking': 1 for highest urgency, 2 for next, etc.
    - 'tags': Generate 2‑4 relevant lowercase keywords based on title, category, and description.

Return **ONLY** a valid JSON array containing ALL formatted events, sorted by urgency first, then by parsed_date ascending. **No markdown fences.**
Also do not return duplicate events. 

Input JSON (${events.length} events):
${JSON.stringify(events, null, 2)}
`;

  const t0 = Date.now();
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.2,
    max_tokens: 16000,
    messages: [
      { role: "system", content: "You are an expert event data formatter." },
      { role: "user", content: prompt },
    ],
  });
  console.log("🟢 GPT response in", ((Date.now() - t0) / 1000).toFixed(2), "s");

  const raw = completion.choices[0].message.content.trim();
  console.log("RAW:", raw);
  // strip accidental ```json blocks
  const clean = raw.startsWith("```")
    ? raw.replace(/```json?|```/g, "").trim()
    : raw;
  return JSON.parse(clean);
}
module.exports = {
  fetchPurdueEvents,
  enrichEventsWithDetails,
  formatEventsWithOpenAI,
  fetchStudentEvents,
  fetchFacultyEvents,
};

// ─────────────────────────────────────────────────────────────
// 3) Main (demo run)
// ─────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const t0 = Date.now();
    const list = await fetchPurdueEvents();
    const enriched = await enrichEventsWithDetails(list);
    const complete = enriched
      .filter((e) => e.title && e.date && e.link && e.description) // mimic Python filter
      .slice(0, BATCH_SIZE);
    console.log("🚀 Sending", complete.length, "events to GPT…");
    const formatted = await formatEventsWithOpenAI(complete);
    console.dir(formatted, { depth: null });
    console.log("⏱ total pipeline", ((Date.now() - t0) / 1000).toFixed(2), "s");
  })();
}
