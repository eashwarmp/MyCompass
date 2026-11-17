# MyCompass

A campus events feed for Purdue students and faculty. The backend scrapes events.purdue.edu, uses an LLM to turn
messy event listings into clean, ranked cards, caches the result in Redis, and serves it to an Expo (React Native)
app that runs on iOS, Android and the web.

Built with [@JeevanReddy09](https://github.com/JeevanReddy09) in April–May 2025.

## Why

The university calendar has the data, but not in a shape you can scan quickly. Dates show up as free text
("Today", "Mon, May 5; Tue, May 6; …"), descriptions run several paragraphs, and nothing tells you what is
happening soon. MyCompass gives each event a parsed date, a time, a one-line summary, a category, tags and an
urgency ranking, so the feed reads top to bottom.

## How it works

```
events.purdue.edu ──scrape──▶ Express API ──▶ gpt-4o-mini ──▶ Redis (1 h TTL) ──▶ Expo app
   list page + detail pages      /api/events    normalize & rank     per audience       student / faculty
```

1. **Scrape.** `api/scraper/modified-event-scrapper.js` pulls the student or faculty event list with axios and
   cheerio, then fetches every event's detail page in parallel to get the full description and all of its dates.
2. **Normalize.** One `gpt-4o-mini` call (temperature 0.2) turns the batch into structured JSON:
   `parsed_date`, `additional_days`, `time`, `short_description`, `category`, `tags` and `ranking`. Relative
   dates are resolved against today's date, and duplicates are removed.
3. **Cache.** The result is stored in Redis under `events:student` or `events:faculty` for an hour, so repeat
   loads skip both the scrape and the LLM call.
4. **Serve.** `GET /api/events?audience=student|faculty` returns the ranked list. The app picks the audience
   from the `?audience=` URL parameter and has separate student and faculty views.

An earlier Python version of the pipeline (Flask, BeautifulSoup, thread-pooled detail fetches) is in
`api/event_scrapper_flask.py`.

## Stack

- **App:** Expo 52, React Native 0.76, TypeScript, React Navigation, react-native-web
- **API:** Node.js, Express 5, axios, cheerio, OpenAI SDK, Redis
- **Deploy:** Render (`render.yaml` defines the API and the static web build)

## Run locally

Needs Node 18+ and a Redis instance.

```sh
npm install
(cd api && npm install)

# api/.env
OPENAI_API_KEY=...
REDIS_URL=redis://localhost:6379

npm run server   # API on http://localhost:9000
npm run web      # or: npm run ios / npm run android
```

Set `EXPO_PUBLIC_API_URL` if the API isn't on `localhost:9000`.

## Project layout

```
App.tsx, src/            Expo app: screens, navigation, event cards, useEvents hook
api/app.js               Express server, Redis cache, /api/events
api/scraper/             Scraper + LLM formatting step
api/event_scrapper_flask.py   Earlier Python/Flask version
render.yaml              Render blueprint for the API and the web build
```
