import os
import requests
import json
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from openai import OpenAI
from datetime import date
import traceback
import time
import re # Needed for cleaning aria-label

# --- Configuration ---
# Load environment variables from .env file
load_dotenv()

# Configure OpenAI client (reads OPENAI_API_KEY from environment)
try:
    client = OpenAI()
except Exception as e:
    print(f"❌ Failed to initialize OpenAI client: {e}")
    print("Ensure your OPENAI_API_KEY is set in the .env file.")
    exit(1)

# URL to scrape
PURDUE_EVENTS_URL = "https://events.purdue.edu/"

# OpenAI Model Configuration
OPENAI_MODEL = "gpt-4o-mini" # Or "gpt-4-turbo", etc.
MAX_TOKENS_COMPLETION = 4000 # Adjust based on expected output length and model limits

# Controls how many events are sent to OpenAI in one batch.
# Set to None to send all filtered events (beware of token limits/costs).
# Set to a number (e.g., 15) to limit the batch size.
EVENT_BATCH_SIZE_FOR_OPENAI = 7

# Browser-like Headers for Requests
REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
}

# --- Web Scraping Function ---
def fetch_purdue_events():
    """
    Scrapes raw event data from Purdue Events.
    - Gets Title, Link, Image, Location (basic) from the main list page.
    - Visits each event's detail page to get Date (from header) and Description.
    """
    print(f"🟡 Requesting data from {PURDUE_EVENTS_URL}...")
    try:
        list_response = requests.get(PURDUE_EVENTS_URL, headers=REQUEST_HEADERS, timeout=20)
        list_response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching list URL {PURDUE_EVENTS_URL}: {e}")
        return []

    print("🟢 Successfully fetched event list HTML. Parsing...")
    list_soup = BeautifulSoup(list_response.text, 'lxml')
    events = []
    event_cards = list_soup.select(".em-card")
    print(f"🔍 Found {len(event_cards)} potential event cards on the main page.")
    event_count = 0

    for el in event_cards:
        event_count += 1
        print(f"\n--- Processing card {event_count}/{len(event_cards)} ---")

        # --- Extract basic info from List Page Card (el) ---
        title_tag = el.select_one(".em-card_title a")
        title = title_tag.text.strip() if title_tag else None

        if not title:
            print("   Skipping card: No title found.")
            continue
        print(f"   Title: {title}")

        # Location from List Page (basic attempt)
        location_tag = el.select_one(".em-card_event-text a")
        location = location_tag.text.strip() if location_tag else None
        if not location:
             date_text_tag = el.select_one(".em-card_event-text")
             if date_text_tag and date_text_tag.find_next_sibling(class_="em-card_event-text"):
                possible_loc_tag = date_text_tag.find_next_sibling(class_="em-card_event-text")
                if possible_loc_tag and not possible_loc_tag.find('a'):
                    location = possible_loc_tag.text.strip()
        print(f"   Location (from list page): {location}")

        # Link from List Page
        link = title_tag['href'] if title_tag and title_tag.has_attr('href') else None
        full_link = f"https://events.purdue.edu{link}" if link and link.startswith('/') else link
        print(f"   Link: {full_link}")

        # Image from List Page
        img_tag = el.select_one("img")
        img_src = img_tag['src'] if img_tag and img_tag.has_attr('src') else None
        full_image = f"https://events.purdue.edu{img_src}" if img_src and img_src.startswith('/') else img_src
        print(f"   Image: {full_image}")

        # --- Fetch Detail Page for Date and Description ---
        description = None
        detail_page_date_str = None # Initialize date string for this event

        if full_link:
            print(f"   ➡️ Fetching detail page: {full_link}")
            try:
                time.sleep(0.3) # Politeness delay
                detail_response = requests.get(full_link, headers=REQUEST_HEADERS, timeout=15)
                detail_response.raise_for_status()
                detail_soup = BeautifulSoup(detail_response.text, 'lxml')

                # --- Extract Date from Detail Page Header ---
                primary_date_str = None
                additional_dates_str = None
                date_container = detail_soup.select_one("div.em-list_dates__container") # Use __
                if date_container:
                    primary_date_tag = date_container.select_one("p.em-date")
                    if primary_date_tag:
                        primary_date_str = primary_date_tag.get_text(strip=True)

                    extra_dates_msg_tag = date_container.select_one("div.em-list_dates__extra-message") # Use __
                    if extra_dates_msg_tag and extra_dates_msg_tag.has_attr('aria-label'):
                        aria_label_text = extra_dates_msg_tag['aria-label']
                        cleaned_aria_label = re.sub(
                            r'^(Additional Event Dates:|Additional Event y,|Additional Dates:)\s*', '',
                            aria_label_text, flags=re.IGNORECASE
                        ).strip()
                        if cleaned_aria_label:
                             additional_dates_str = cleaned_aria_label

                    # Combine Dates
                    if primary_date_str and additional_dates_str:
                        detail_page_date_str = f"{primary_date_str}; {additional_dates_str}"
                    elif primary_date_str:
                        detail_page_date_str = primary_date_str
                print(f"   ✅ Date (from detail page): {detail_page_date_str}")
                # --- End Date Extraction ---

                # --- Extract Description from Detail Page ---
                description_tag = detail_soup.select_one("div.em-about_description") # Use _
                if description_tag:
                    description = description_tag.get_text(separator="\n", strip=True)
                    print(f"   ✅ Found description (length: {len(description)})")
                else:
                    print("   ⚠️ Description element 'div.em-about_description' not found on detail page.")
                # --- End Description Extraction ---

            except requests.exceptions.RequestException as detail_err:
                print(f"   ❌ Error fetching detail page {full_link}: {detail_err}")
            except Exception as parse_err:
                 print(f"   ❌ Error parsing detail page {full_link}: {parse_err}")
        else:
            print("   ⚠️ Skipping detail page fetch: No link found.")
        # -----------------------------------------

        # --- Append Event Data ---
        # Use date extracted from detail page
        events.append({
            "title": title,
            "date": detail_page_date_str, # Use date from detail page
            "location": location, # Still using location from list page card
            "link": full_link,
            "image": full_image,
            "description": description,
        })

    print(f"\n✅ Extracted {len(events)} events total from scraping phase.")
    return events

# --- OpenAI Formatting Function ---
# (Keep the format_events_with_openai function exactly as it was in the previous full script response -
#  it handles the combined date string, token checks, finish reason, etc.)
def format_events_with_openai(events_to_process):
    """Formats scraped event data using OpenAI GPT, including summarizing descriptions."""

    num_events_sending = len(events_to_process)
    print(f"🤖 Formatting {num_events_sending} events with OpenAI...")

    if not events_to_process:
        print("   No events to format.")
        return None, 0 # Return None for content, 0 for count sent

    today_str = date.today().strftime("%a, %b %d, %Y")

    # Construct the prompt for OpenAI
    prompt = f"""
You are an event data formatter. You will receive a list of university events. Each event has a combined 'date' field (which might represent multiple dates or a range, possibly joined by ';') and may optionally include a 'description'.

Today's date is: {today_str}

Your task is to process the following JSON input array:
- For each event:
  - Parse the original 'date' field into two new fields:
    - 'parsed_date': Represent the primary date or date range found (e.g., "Mon, May 5, 2025", "Apr 23 - Apr 25, 2025", "May 15, 2025"). Standardize simple relative dates like "Today" or "Tomorrow" to their actual date based on today's date ({today_str}). If the input combines multiple dates (e.g. separated by ';'), try to represent the range or the first date clearly. If unparseable, use null.
    - 'time': extract the time portion (e.g., "3pm to 4pm", "10:00 AM - 11:00 AM") or use null if no time is present in the original 'date' field or if multiple times are listed ambiguously.
  - Process the 'description' field (if present and not null/empty):
    - Create a new field 'short_description' containing a concise summary (1-2 sentences) of the original 'description'. Focus on the core activity or purpose.
    - If the original 'description' is null or empty, set 'short_description' to null.
  - Keep the original fields: title, location, link, image, description.
  - Add new fields:
    - 'category': Guess a relevant category from the title and description (e.g., "Seminar", "Music", "Career Fair", "Workshop", "Arts", "Sports", "Social", "Lecture", "Expo", "Commencement"). Use "General" if unsure.
    - 'urgency': Calculate based on 'parsed_date' relative to today ({today_str}). Use 'high' if the event starts today, tomorrow, or within the next 3 days (inclusive of today). Use 'medium' if within the next 7 days. Use 'low' otherwise. If the date is unparseable or in the past, use 'low'.
    - 'tags': Generate 2-4 relevant lowercase keywords based on title, category, and description.

Return ONLY a valid JSON array containing the formatted event objects for ALL the events provided in the input. Do NOT include any introduction, explanation, markdown formatting (like ```json), or concluding remarks. Ensure the output is a single, complete JSON array.
The output should be arranged according to the priority.
Input JSON ({num_events_sending} events):
{json.dumps(events_to_process, indent=2)}
"""

    try:
        print(f"   Sending request to OpenAI API ({OPENAI_MODEL})...")
        completion = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert event data formatter. You receive event data, enhance it by parsing dates, summarizing descriptions, adding categories/urgency/tags, and return ONLY a valid JSON array containing objects for all input events."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2,
            max_tokens=MAX_TOKENS_COMPLETION,
            # response_format={ "type": "json_object" } # KEEP THIS COMMENTED OUT
        )
        print("   Received response from OpenAI.")

        if completion.usage:
            print(f"   Token Usage: Prompt={completion.usage.prompt_tokens}, Completion={completion.usage.completion_tokens}, Total={completion.usage.total_tokens}")
            if completion.usage.completion_tokens >= MAX_TOKENS_COMPLETION - 10:
                 print("   ⚠️ WARNING: Completion tokens reached near max_tokens limit. Output might be truncated.")

        if completion.choices and completion.choices[0].message:
            response_content = completion.choices[0].message.content
            finish_reason = completion.choices[0].finish_reason
            print(f"   Finish Reason: {finish_reason}")
            if finish_reason == 'length':
                print("   ⚠️ WARNING: OpenAI stopped generating due to reaching max_tokens (finish_reason='length'). Output is likely incomplete.")
            elif finish_reason != 'stop':
                 print(f"   ℹ️ Note: OpenAI stopped generating due to {finish_reason}.")

            print("✅ OpenAI formatting call complete.")
            return response_content, num_events_sending
        else:
            print("❌ Error: Unexpected OpenAI response structure (no choices/message).")
            print(completion)
            return None, num_events_sending

    except Exception as e:
        print(f"❌ Error calling OpenAI API: {e}")
        traceback.print_exc()
        return None, num_events_sending


# --- Main Runner ---
# (Keep the main function exactly as it was in the previous full script response -
#  it includes filtering, batch size logic, raw output printing, parsing,
#  discrepancy checks, etc.)
def main():
    """Main function to orchestrate scraping, filtering, and formatting."""
    total_start_time = time.time()
    num_events_sent_to_openai = 0 # Initialize count

    try:
        # --- Scraping ---
        scrape_start_time = time.time()
        raw_events = fetch_purdue_events()
        scrape_time = time.time() - scrape_start_time
        print(f"\n⏱️ Scraping took {scrape_time:.2f} seconds.")
        print(f"📊 Found {len(raw_events)} raw events initially.")

        if not raw_events:
            print("⏹️ No events were scraped. Exiting.")
            return

        # --- Filtering ---
        print("\n🔍 Filtering events to keep only those with complete details...")
        filtered_events = []
        required_keys = ['title', 'date', 'location', 'link', 'description']
        for event in raw_events:
            if all(event.get(key) for key in required_keys):
                filtered_events.append(event)


        print(f"✅ Kept {len(filtered_events)} events after filtering.")

        if not filtered_events:
            print("⏹️ No events with complete details found to format. Exiting.")
            return

        # --- Prepare Batch for OpenAI ---
        if EVENT_BATCH_SIZE_FOR_OPENAI is not None:
            events_for_batch = filtered_events[:EVENT_BATCH_SIZE_FOR_OPENAI]
            print(f"📦 Selecting first {len(events_for_batch)} events based on BATCH_SIZE = {EVENT_BATCH_SIZE_FOR_OPENAI}.")
        else:
            events_for_batch = filtered_events
            print(f"📦 Processing all {len(events_for_batch)} filtered events in one batch.")


        # --- OpenAI Formatting ---
        format_start_time = time.time()
        formatted_events_str, num_events_sent_to_openai = format_events_with_openai(events_for_batch)
        format_time = time.time() - format_start_time
        print(f"⏱️ OpenAI Formatting took {format_time:.2f} seconds.")


        # --- Process Response ---
        if formatted_events_str:
            print("\n--- Formatted Events (Raw String from OpenAI) ---")
            print(formatted_events_str) # Print the entire raw string
            print("--- End Raw String ---")

            # --- Attempt to Parse and Validate ---
            parsed_json = None
            num_events_received_from_openai = 0
            try:
                # Clean potential markdown fences
                if formatted_events_str.strip().startswith("```json"):
                    formatted_events_str = formatted_events_str.strip()[7:-3].strip()
                elif formatted_events_str.strip().startswith("```"):
                     formatted_events_str = formatted_events_str.strip()[3:-3].strip()

                parsed_json = json.loads(formatted_events_str)

                if isinstance(parsed_json, list):
                    num_events_received_from_openai = len(parsed_json)
                    print(f"\n✅ Successfully parsed response as a JSON list containing {num_events_received_from_openai} events.")

                    # --- CHECK FOR DISCREPANCY ---
                    if num_events_received_from_openai != num_events_sent_to_openai:
                        print(f"\n⚠️ WARNING: Sent {num_events_sent_to_openai} events to OpenAI, but received {num_events_received_from_openai} events back in the response!")
                        print("   This might indicate the response was truncated or the model didn't process all items.")
                    # --- END CHECK ---

                    print("\n✅ Formatted Events (Parsed JSON):\n")
                    print(json.dumps(parsed_json, indent=2))

                elif isinstance(parsed_json, dict):
                     print("\n⚠️ WARNING: Parsed response is a JSON dictionary, not a list as requested.")
                     found_list = False
                     for key, value in parsed_json.items():
                         if isinstance(value, list):
                             print(f"   Found a list under the key '{key}'. Processing this list.")
                             parsed_json = value
                             num_events_received_from_openai = len(parsed_json)
                             found_list = True
                             if num_events_received_from_openai != num_events_sent_to_openai:
                                print(f"   ⚠️ WARNING: Sent {num_events_sent_to_openai} events to OpenAI, but received {num_events_received_from_openai} events back in the nested list!")
                             print("\n✅ Formatted Events (Extracted List):\n")
                             print(json.dumps(parsed_json, indent=2))
                             break
                     if not found_list:
                         print("   Could not find a list within the dictionary response. Displaying the dictionary.")
                         print(json.dumps(parsed_json, indent=2))
                else:
                     print("\n⚠️ WARNING: Parsed response is valid JSON, but not a list or dictionary.")
                     print(parsed_json)

            except json.JSONDecodeError as json_err:
                print(f"\n❌❌❌ FAILED TO PARSE OPENAI RESPONSE AS JSON: {json_err}")
                print("   The raw string received is printed above ('Raw String from OpenAI'). Check it carefully for errors or truncation.")
            except Exception as parse_err:
                 print(f"\n❌ An error occurred processing the OpenAI JSON response: {parse_err}")
                 traceback.print_exc()
        else:
            print("\n❌ Failed to get formatted events string from OpenAI function.")

    except Exception as err:
        print(f"❌ An unexpected error occurred in the main execution: {err}")
        traceback.print_exc()
    finally:
        total_time = time.time() - total_start_time
        print(f"\n🏁 Script finished in {total_time:.2f} seconds.")


if __name__ == "__main__":
    # Ensure required libraries are installed:
    # pip install requests beautifulsoup4 python-dotenv openai lxml
    main()