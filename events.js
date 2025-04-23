const axios = require("axios");
const cheerio = require("cheerio");

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

fetchPurdueEvents().then(console.log);
