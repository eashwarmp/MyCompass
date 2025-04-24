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
    const rawEvents = await fetchPurdueEvents();
    const enrichedEvents = await enrichEventsWithDetails(rawEvents);
    res.json(
      enrichedEvents.map((event, index) => ({
        id: String(index + 1),
        title: event.title,
        subtitle: event.date || "Date TBA",
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
