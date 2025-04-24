// hooks/useEvents.ts
import { useEffect, useState } from "react";
import axios from "axios";
import { EventItem } from "../interfaces/events";

export function useEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get<EventItem[]>(
          "http://localhost:9000/api/events"
        ); // proxy or full URL
        setEvents(data);
      } catch (err) {
        console.error("fetch events failed:", err);
      }
    })();
  }, []);

  return { events };
}
