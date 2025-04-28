// At the top
const express = require("express");
const cors = require("cors");
const {
  fetchPurdueEvents,
  enrichEventsWithDetails,
} = require("./scraper/event-scrapper");

const app = express();
const PORT = 9000;

app.use(cors());
// app.use(cors({ origin: "http://localhost:8081" }));
// ✅ allow all origins
app.use(express.json()); // just in case for body parsing

// Create a router and hook it in properly
const router = express.Router();

router.get("/events", async (req, res) => {
  try {
    console.log("Inside");
    console.time("Total fetch");

    console.time("Fetch raw events");
    const rawEvents = await fetchPurdueEvents();
    console.timeEnd("Fetch raw events");

    console.time("Enrich events");
    const enrichedEvents = await enrichEventsWithDetails(rawEvents);
    console.timeEnd("Enrich events");

    console.timeEnd("Total fetch");

    const filteredEvents = enrichedEvents.filter(
      (event) => event.date && event.date.trim() !== ""
    );

    res.json(
      filteredEvents.map((event, index) => ({
        id: String(index + 1),
        title: event.title,
        subtitle: event.date,
        icon: "calendar",
        cover: event.image || "https://fallback.image/url.jpg",
        location: event.location || "TBA",
        description: event.description || "",
      }))
    );
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
