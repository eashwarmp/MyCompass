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

// 🧹 Scrape events from listing page
async function fetchPurdueEvents() {
  const response = await axios.get(PURDUE_EVENTS_URL);
  const $ = cheerio.load(response.data);
  const events = [];

  $(".em-card").each((i, el) => {
    const title = $(el).find(".em-card_title").text().trim();
    const date = $(el).find(".em-card_event-text").first().text().trim();
    const location = $(el).find(".em-card_event-text a").text().trim();
    const link = $(el).find(".em-card_title a").attr("href");
    const image = $(el).find("img").attr("src");

    const fullLink = link?.startsWith("http")
      ? link
      : `https://events.purdue.edu${link}`;

    if (title) {
      events.push({
        title,
        date,
        location,
        link: fullLink,
        image,
      });
    }
  });

  return events;
}

async function enrichEventsWithDetails(events) {
  const enriched = await Promise.all(
    events.map(async (event) => {
      try {
        const res = await axios.get(event.link);
        const $ = cheerio.load(res.data);

        // Fill missing date
        if (!event.date || event.date === "") {
          const fullDate = $(".em-about_event-date").text().trim();
          if (fullDate) event.date = fullDate;
        }

        // Fill missing description
        if (!event.description || event.description === "") {
          const descriptionParagraphs = $(".em-about_description p")
            .map((i, el) => $(el).text().trim())
            .get()
            .filter(Boolean);

          if (descriptionParagraphs.length) {
            event.description = descriptionParagraphs.join("\n\n");
          }
        }
      } catch (err) {
        console.warn(`❌ Could not enrich event: ${event.title}`, err.message);
      }

      return event;
    })
  );

  return enriched;
}

// 🚀 Main runner
(async () => {
  try {
    const scraped = await fetchPurdueEvents();
    console.log("🔍 Initial Events:", scraped.length);

    const enriched = await enrichEventsWithDetails(scraped);
    console.log(
      "✅ Final Enriched Events:\n",
      JSON.stringify(enriched, null, 2)
    );
    // const formattedEvents = await formatEventsWithOpenAI(rawEvents);
    // console.log("\n✅ Formatted Events:\n", formattedEvents);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
