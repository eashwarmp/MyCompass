export interface EventItem {
  id: string; // ← comes from API
  title: string;
  subtitle: string; // date / time
  icon: string; // “calendar” for now
  cover: string; // image url (or placeholder)
  location: string;
  description?: string; // NEW
  link?: string; // optional – opens original site
}
