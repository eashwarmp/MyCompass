export interface EventItem {
  title: string;
  date: string; // full date-time string
  parsed_date?: string;
  additional_days?: number;
  time?: string;
  location: string;
  description: string;
  image: string; // was `cover`
  link: string;
  short_description?: string;
  category?: string;
  tags?: string[];
  ranking?: number;
}
