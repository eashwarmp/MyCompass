import { useEffect, useState } from "react";
import axios from "axios";
import { EventItem } from "../interfaces/events";
import { Linking } from "react-native";

export function useEvents(audienceOverride?: string) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [audience, setAudience] = useState<"student" | "faculty">(
    audienceOverride === "faculty" ? "faculty" : "student"
  );

  useEffect(() => {
    async function detectAudienceFromURL() {
      if (audienceOverride) return; // skip if manually passed

      const url = await Linking.getInitialURL();
      console.log("URL ---> ", url);
      if (url) {
        const match = url.match(/[?&]audience=(faculty|student)/i);
        if (match) {
          setAudience(match[1] as "faculty" | "student");
        }
      }
    }

    detectAudienceFromURL();
  }, []);

  async function fetchEvents() {
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.REACT_APP_API_URL || "http://localhost:9000";
      const { data } = await axios.get<EventItem[]>(
        `${API_URL}/api/events?audience=${audience}`
      );
      setEvents(data);
    } catch (err) {
      console.error("fetch events failed:", err);
    }
  }

  useEffect(() => {
    if (audience) {
      fetchEvents();
    }
  }, [audience]);

  return { events, reload: fetchEvents, audience };
}
