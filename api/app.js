// At the top
const express = require("express");
const cors = require("cors");
const redis = require("redis");
const { promisify } = require("util");
const {
  fetchStudentEvents,
  fetchFacultyEvents,
  enrichEventsWithDetails,
  formatEventsWithOpenAI,
} = require("./scraper/modified-event-scrapper");

const app = express();
const PORT = process.env.PORT || 9000;

// Redis client setup
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

redisClient.on("error", (err) => console.error("Redis Client Error:", err));

// Connect to Redis before promisifying methods
redisClient.connect().catch(console.error);

// Promisify Redis methods - using the newer Redis client API
const getAsync = async (key) => await redisClient.get(key);
const setexAsync = async (key, seconds, value) => await redisClient.setEx(key, seconds, value);

app.use(cors());
// ✅ allow all origins
app.use(express.json()); // just in case for body parsing

// Create a router and hook it in properly
const router = express.Router();

router.get("/events", async (req, res) => {
  try {
    console.time("⏱ /api/events");
    
    const isFaculty = req.query.audience === "faculty";
    const cacheKey = `events:${isFaculty ? 'faculty' : 'student'}`;
    
    // Try to get data from cache first
    const cachedData = await getAsync(cacheKey);
    if (cachedData) {
      console.log("🎯 Cache hit! Returning cached events");
      console.timeEnd("⏱ /api/events");
      return res.json(JSON.parse(cachedData));
    }
    
    console.log("❌ Cache miss. Fetching fresh events...");
    console.time("Fetch raw events");

    const rawEvents = isFaculty
      ? await fetchFacultyEvents()
      : await fetchStudentEvents();

    console.timeEnd("Fetch raw events");

    console.time("Enrich events");
    const enrichedEvents = await enrichEventsWithDetails(rawEvents);
    console.log("Events ----------------------_> ", enrichedEvents);
    console.timeEnd("Enrich events");
    const formatted = enrichedEvents
      .filter((e) => e.title && e.date && e.link && e.description)
      .slice(0, 10);
    console.log("🚀 Sending", formatted.length, "events to GPT…");

    console.time("OpenAI Call");
    const openAIResp = await formatEventsWithOpenAI(formatted);
    
    // Add this debugging to check if additional_days exists in the response
    console.log("OpenAI Response Sample:", 
      openAIResp.slice(0, 2).map(event => ({
        title: event.title,
        parsed_date: event.parsed_date,
        additional_days: event.additional_days,
        time: event.time
      }))
    );
    
    console.timeEnd("OpenAI Call");
    
    // Cache the result for 1 hour (3600 seconds)
    await setexAsync(cacheKey, 3600, JSON.stringify(openAIResp));
    console.log("💾 Cached events for 1 hour");

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

// Graceful shutdown
process.on('SIGINT', () => {
  redisClient.quit();
  process.exit(0);
});
