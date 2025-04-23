// dependencies: npm install axios cheerio openai dotenv
require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");
const { Configuration, OpenAIApi } = require("openai");
const puppeteer = require("puppeteer");

const headers = {
  Authorization: "Bearer {API_KEY}",
  "Content-Type": "application/json",
};

// The endpoint URL for GPT chat completions
const OPEN_AI_URL = "https://api.openai.com/v1/chat/completions";

// 🌐 URLs to scrape
const PURDUE_EVENTS_URL = "https://events.purdue.edu/";

// 🧹 Scrape raw event data from Purdue Events
// async function scrapePurdueEvents() {
//   const res = await axios.get(PURDUE_EVENTS_URL);
//   const $ = cheerio.load(res.data);
//   console.log("🟡 Scraping Purdue Events...", $);
//   const events = [];

//   $(".event-card").each((i, el) => {
//     const title = $(el).find(".event-title").text().trim();
//     const link = $(el).find("a").attr("href");
//     const date = $(el).find(".event-date").text().trim();
//     const location = $(el).find(".event-location").text().trim();

//     if (title) {
//       events.push({
//         title,
//         date,
//         location,
//         link: link ? `https://events.purdue.edu${link}` : null,
//       });
//     }
//   });

//   return events;
// }

async function fetchPurdueEvents() {
  const url = "https://events.purdue.edu";
  const response = await axios.get(url);
  const $ = cheerio.load(response.data); // Parse the HTML

  const events = [];

  $(".em-card").each((i, el) => {
    const title = $(el).find(".em-card_title").text().trim();
    const date = $(el).find(".em-card_event-text").first().text().trim();
    const location = $(el).find(".em-card_event-text a").text().trim();
    const link = $(el).find(".em-card_title a").attr("href");
    const img = $(el).find("img").attr("src");

    if (title) {
      events.push({
        title,
        date,
        location,
        link: link ? `https://events.purdue.edu${link}` : null,
        image: img ? img : null,
      });
    }
  });

  return events;
}

// 🤖 Format scraped data via OpenAI GPT
async function formatEventsWithOpenAI(rawEvents) {
  const prompt = `
    You are an event data formatter. You will receive a list of university events. Each event has a combined 'date' field that may contain both the date and time.
    
    Today's date is: ${new Date().toDateString()}
    
    Your task is to:
    - Parse 'date' into two fields:
      - 'date': keep the full readable date as-is (e.g., "Mon, May 5, 2025")
      - 'time': extract the time portion (e.g., "3pm to 4pm") or use null if not present
    - Keep the rest of the fields: title, location, link, image
    - Add:
      - 'category' (guess from title, e.g., "Seminar", "Music", "Career")
      - 'urgency': high if the event is within 3 days of today, otherwise medium or low
      - 'tags': 2–4 relevant lowercase keywords based on title and category
    
    Return a valid JSON array of formatted events. Do NOT include any explanation or markdown, only the JSON array.
    
    Input:
    ${JSON.stringify(rawEvents.slice(0, 10), null, 2)}
    `;

  //   const completion = await openai.createChatCompletion({
  //     model: "gpt-4-1106-preview",
  //     messages: [
  //       {
  //         role: "system",
  //         content:
  //           "You are a helpful formatter that turns messy event info into structured JSON.",
  //       },
  //       { role: "user", content: prompt },
  //     ],
  //     temperature: 0.4,
  //     max_tokens: 1000,
  //   });

  const systemMessage = {
    role: "system",
    content:
      "You are a helpful formatter that turns messy event info into structured JSON.",
  };
  const userMessage = {
    role: "user",
    content: `${JSON.stringify(rawEvents, null, 2)}`,
  };

  const data = {
    model: "gpt-4-1106-preview",
    messages: [
      { role: "system", content: "You are a JSON formatter." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 1200,
  };

  const response = await axios.post(OPEN_AI_URL, data, { headers });
  const output = response.data.choices[0].message.content;
  return output;
}

// 🚀 Main runner
(async () => {
  try {
    const rawEvents = await fetchPurdueEvents();
    console.log("🟡 Scraped Raw Events:", rawEvents);
    if (rawEvents.length === 0) {
      console.log("No events found.");
      return;
    }
    const formattedEvents = await formatEventsWithOpenAI(rawEvents);
    console.log("\n✅ Formatted Events:\n", formattedEvents);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
