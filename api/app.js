// At the top
const express = require("express");
const cors = require("cors");
const {
  fetchPurdueEvents,
  enrichEventsWithDetails,
  formatEventsWithOpenAI,
} = require("./scraper/modified-event-scrapper");

const app = express();
const PORT = 9000;

app.use(cors());
// ✅ allow all origins
app.use(express.json()); // just in case for body parsing

// Create a router and hook it in properly
const router = express.Router();

router.get("/events", async (req, res) => {
  try {
    console.time("⏱ /api/events");

    console.time("Fetch raw events");
    const rawEvents = await fetchPurdueEvents();
    console.timeEnd("Fetch raw events");

    console.time("Enrich events");
    const enrichedEvents = await enrichEventsWithDetails(rawEvents);
    console.log("Events ----------------------_> ", enrichedEvents);
    console.timeEnd("Enrich events");
    const formatted = enrichedEvents
      .filter((e) => e.title && e.date && e.link && e.description)
      .slice(0, 7);
    console.log("🚀 Sending", formatted.length, "events to GPT…");

    console.time("OpenAI Call");
    const openAIResp = await formatEventsWithOpenAI(formatted);
    console.timeEnd("Total fetch");

    console.timeEnd("⏱ /api/events");

    res.json(openAIResp);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch events", details: err.message });
  }
});

// ✅ Don't forget this
app.use("/api", router);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
