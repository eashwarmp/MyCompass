import os
import requests
import json
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from openai import OpenAI
from datetime import date, datetime, timedelta
import traceback
import time
import re # Needed for cleaning aria-label
from concurrent.futures import ThreadPoolExecutor, as_completed


# --- Flask Setup ---
from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)
CORS(app, resources={r"/events": {"origins": "http://localhost:8081"}})

# --- Configuration ---
# Load environment variables from .env file
load_dotenv()

# Configure OpenAI client (reads OPENAI_API_KEY from environment)
# Initialize lazily or handle potential absence gracefully at startup
client = None
openai_init_error = None
try:
    client = OpenAI()
    print("✅ OpenAI client initialized successfully.")
except Exception as e:
    openai_init_error = f"❌ Failed to initialize OpenAI client: {e}. Ensure your OPENAI_API_KEY is set in the .env file."
    print(openai_init_error)


# URL to scrape
PURDUE_EVENTS_URL = "https://events.purdue.edu/"

def timed(fn):
    def wrapper(*args, **kwargs):
        t0 = time.time()
        result = fn(*args, **kwargs)
        t1 = time.time()
        print(f"⏱ {fn.__name__!r} took {t1-t0:.2f}s")
        return result
    return wrapper

# OpenAI Model Configuration
OPENAI_MODEL = "gpt-3.5-turbo" # Or "gpt-4-turbo", etc.
MAX_TOKENS_COMPLETION = 4000 # Adjust based on expected output length and model limits

# Controls how many events are sent to OpenAI in one batch.
# Set to None to send all filtered events (beware of token limits/costs).
# Set to a number (e.g., 15) to limit the batch size.
EVENT_BATCH_SIZE_FOR_OPENAI = 7 # Keep a reasonable default for API calls

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

# --- Helper to parse relative dates/calculate urgency ---
def calculate_urgency_and_parse_date(date_str, today):
    """
    Attempts to parse date_str and determine urgency.
    Returns a tuple: (parsed_date_string, urgency_level)
    """
    if not date_str:
        return None, 'low' # Cannot parse, default to low urgency

    date_str_lower = date_str.lower()
    urgency = 'low'
    parsed_date = date_str # Default to original if parsing fails
    event_date = None

    try:
        # Simple attempts for common formats or relative terms
        if 'today' in date_str_lower:
             event_date = today
        elif 'tomorrow' in date_str_lower:
             event_date = today + timedelta(days=1)
        else:
             # Attempt to parse standard date formats
             # This is basic; `dateutil` is better for complex cases
             for fmt in ["%a, %b %d, %Y", "%b %d, %Y", "%m/%d/%Y"]:
                 try:
                     # Handle potential year absence if only month/day is given
                     temp_date_str = date_str.split(';')[0].strip() # Take first part if multiple
                     if len(temp_date_str.split(',')) == 1: # Might be just "Month Day"
                          temp_date_str += f", {today.year}" # Assume current year

                     event_date = datetime.strptime(temp_date_str, fmt).date()
                     # If parsed date is in the past, try next year
                     if event_date < today and event_date.month >= today.month: # Avoid jumping a full year for events later this year
                         event_date = event_date.replace(year=today.year + 1)
                     elif event_date < today and event_date.month < today.month:
                          pass # It's in the past or earlier this year
                     break # Stop if parsing is successful
                 except ValueError:
                     continue # Try next format

        if event_date:
             delta = event_date - today
             if 0 <= delta.days <= 3:
                 urgency = 'high'
             elif 3 < delta.days <= 7:
                 urgency = 'medium'
             else:
                 urgency = 'low'
             parsed_date = event_date.strftime("%a, %b %d, %Y") # Standardize format if parsed

    except Exception as e:
        print(f"⚠️ Could not reliably parse date string '{date_str}' for urgency check: {e}")
        # Fallback: keep original string, keep low urgency

    return parsed_date, urgency # Note: This function doesn't handle time extraction, LLM does.

# --- Web Scraping Function ---
@timed
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
        return [], f"Error fetching event list: {e}"

    print("🟢 Successfully fetched event list HTML. Parsing...")
    list_soup = BeautifulSoup(list_response.text, 'lxml')
    events = []
    event_cards = list_soup.select(".em-card")
    print(f"🔍 Found {len(event_cards)} potential event cards on the main page.")
    event_count = 0

    for el in event_cards:
        event_count += 1
        # print(f"\n--- Processing card {event_count}/{len(event_cards)} ---") # Too verbose for logs

        # --- Extract basic info from List Page Card (el) ---
        title_tag = el.select_one(".em-card_title a")
        title = title_tag.text.strip() if title_tag else None

        if not title:
            # print("   Skipping card: No title found.") # Too verbose
            continue
        # print(f"   Title: {title}") # Too verbose

        # Location from List Page (basic attempt)
        location_tag = el.select_one(".em-card_event-text a")
        location = location_tag.text.strip() if location_tag else None
        if not location:
            # Sometimes location is not a link but just text after date
             date_text_tag = el.select_one(".em-card_event-text")
             if date_text_tag and date_text_tag.find_next_sibling(class_="em-card_event-text"):
                possible_loc_tag = date_text_tag.find_next_sibling(class_="em-card_event-text")
                if possible_loc_tag and not possible_loc_tag.find('a'): # Ensure it's not another link (like time)
                    location = possible_loc_tag.text.strip()
        # print(f"   Location (from list page): {location}") # Too verbose

        # Link from List Page
        link = title_tag['href'] if title_tag and title_tag.has_attr('href') else None
        full_link = f"https://events.purdue.edu{link}" if link and link.startswith('/') else link
        # print(f"   Link: {full_link}") # Too verbose

        # Image from List Page
        img_tag = el.select_one("img")
        img_src = img_tag['src'] if img_tag and img_tag.has_attr('src') else None
        full_image = f"https://events.purdue.edu{img_src}" if img_src and img_src.startswith('/') else img_src
        # print(f"   Image: {full_image}") # Too verbose

        # --- Fetch Detail Page for Date and Description ---
        description = None
        detail_page_date_str = None # Initialize date string for this event

        if full_link:
            # print(f"   ➡️ Fetching detail page: {full_link}") # Too verbose
            try:
                # time.sleep(0.1) # Politeness delay - slightly reduced for potential web service use
                detail_response = requests.get(full_link, headers=REQUEST_HEADERS, timeout=15)
                detail_response.raise_for_status()
                detail_soup = BeautifulSoup(detail_response.text, 'lxml')

                # --- Extract Date from Detail Page Header ---
                primary_date_str = None
                additional_dates_str = None
                date_container = detail_soup.select_one("div.em-list_dates__container")
                if date_container:
                    primary_date_tag = date_container.select_one("p.em-date")
                    if primary_date_tag:
                        primary_date_str = primary_date_tag.get_text(strip=True)

                    # Extracting additional dates from aria-label
                    extra_dates_msg_tag = date_container.select_one("div.em-list_dates__extra-message")
                    if extra_dates_msg_tag and extra_dates_msg_tag.has_attr('aria-label'):
                        aria_label_text = extra_dates_msg_tag['aria-label']
                        # Use regex to clean potential prefixes
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
                # print(f"   ✅ Date (from detail page): {detail_page_date_str}") # Too verbose
                # --- End Date Extraction ---

                # --- Extract Description from Detail Page ---
                description_tag = detail_soup.select_one("div.em-about_description")
                if description_tag:
                    description = description_tag.get_text(separator="\n", strip=True)
                    # print(f"   ✅ Found description (length: {len(description)})") # Too verbose
                else:
                    # print("   ⚠️ Description element 'div.em-about_description' not found on detail page.") # Too verbose
                    pass # Allow events without description to pass scraping, filter later
                # --- End Description Extraction ---

            except requests.exceptions.RequestException as detail_err:
                print(f"   ❌ Error fetching detail page {full_link}: {detail_err}")
            except Exception as parse_err:
                 print(f"   ❌ Error parsing detail page {full_link}: {parse_err}")
        # else:
            # print("   ⚠️ Skipping detail page fetch: No link found.") # Too verbose
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
    return events, None # Return events list and None for error

# --- OpenAI Formatting Function ---
@timed
def format_events_with_openai(events_to_process):
    """Formats scraped event data using OpenAI GPT, including summarizing descriptions."""

    if openai_init_error:
        print("❌ OpenAI client not initialized. Skipping formatting.")
        return None, 0, openai_init_error

    num_events_sending = len(events_to_process)
    print(f"🤖 Formatting {num_events_sending} events with OpenAI...")

    if not events_to_process:
        print("   No events to format.")
        return None, 0, None # Return None for content, 0 for count sent, None for error

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
    - -'ranking' : Once you’ve built all objects, **sort them by urgency** (high→medium→low) & importance, then **assign it to ranking `"ranking"`**: 1 for highest urgency, 2 for next, etc.
    - 'tags': Generate 2-4 relevant lowercase keywords based on title, category, and description.

Return ONLY a valid JSON array containing the formatted event objects for ALL the events provided in the input. Do NOT include any introduction, explanation, markdown formatting (like ```json), or concluding remarks. Ensure the output is a single, complete JSON array.
The output should be arranged according to the urgency ('high' first, then 'medium', then 'low'), and then by parsed_date (earliest first).
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
                    "content": "You are an expert event data formatter. You receive event data, enhance it by parsing dates, summarizing descriptions, adding categories/urgency/tags, and return ONLY a valid JSON array containing objects for all input events, sorted by urgency and date."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2,
            max_tokens=MAX_TOKENS_COMPLETION,
            # response_format={ "type": "json_object" } # KEEP THIS COMMENTED OUT as it can cause issues
        )
        print("   Received response from OpenAI.")

        if completion.usage:
            print(f"   Token Usage: Prompt={completion.usage.prompt_tokens}, Completion={completion.usage.completion_tokens}, Total={completion.usage.total_tokens}")
            if completion.usage.completion_tokens >= MAX_TOKENS_COMPLETION - 500: # More buffer
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
            return response_content, num_events_sending, None # Return content, count sent, None for error
        else:
            print("❌ Error: Unexpected OpenAI response structure (no choices/message).")
            print(completion)
            return None, num_events_sending, "Unexpected OpenAI response structure."

    except Exception as e:
        print(f"❌ Error calling OpenAI API: {e}")
        traceback.print_exc()
        return None, num_events_sending, f"Error calling OpenAI API: {e}"


# --- Flask Routes ---

@app.route('/')
def index():
    """Root endpoint."""
    status = "Operational" if client else "Degraded (OpenAI client failed to initialize)"
    message = "Purdue Events Scraper and Formatter Service"
    if openai_init_error:
        message += f"\nWARNING: {openai_init_error}"
    return jsonify({"status": status, "message": message})

@app.route('/events', methods=['GET'])
def get_events():
    """
    Endpoint to trigger the event scraping and formatting process.
    Returns a JSON array of formatted events.
    """
    print("\n--- Received request to /events ---")
    t_start = time.time()
    total_start_time = time.time()

    # --- Scraping ---
    scrape_start_time = time.time()
    raw_events, scrape_error = fetch_purdue_events()
    scrape_time = time.time() - scrape_start_time
    print(f"\n⏱️ Scraping took {scrape_time:.2f} seconds.")
    print(f"📊 Found {len(raw_events)} raw events initially.")

    if scrape_error:
        return jsonify({"status": "error", "message": scrape_error, "step": "scraping"}), 500

    if not raw_events:
        print("⏹️ No events were scraped.")
        total_time = time.time() - total_start_time
        print(f"🏁 Request finished in {total_time:.2f} seconds.")
        return jsonify({"status": "success", "message": "No events found to process.", "events": []})

    # --- Filtering ---
    print("\n🔍 Filtering events to keep only those with complete details...")
    filtered_events = []
    # Require at least title, date, link, and description before sending to LLM
    # Location is often missing or ambiguous, image isn't strictly required for formatting
    required_keys_for_formatting = ['title', 'date', 'link', 'description']
    for event in raw_events:
        # Check if required keys exist AND their values are not None/empty string
        if all(event.get(key) for key in required_keys_for_formatting):
             # Ensure description is not just whitespace
             if event.get('description', '').strip():
                 filtered_events.append(event)


    print(f"✅ Kept {len(filtered_events)} events after filtering for formatting.")

    if not filtered_events:
        print("⏹️ No events with complete details found to format.")
        total_time = time.time() - total_start_time
        print(f"🏁 Request finished in {total_time:.2f} seconds.")
        return jsonify({"status": "success", "message": "No events with complete details found to format.", "events": []})


    # --- Prepare Batch for OpenAI ---
    if EVENT_BATCH_SIZE_FOR_OPENAI is not None:
        events_for_batch = filtered_events[:EVENT_BATCH_SIZE_FOR_OPENAI]
        print(f"📦 Selecting first {len(events_for_batch)} events based on BATCH_SIZE = {EVENT_BATCH_SIZE_FOR_OPENAI}.")
    else:
        events_for_batch = filtered_events
        print(f"📦 Processing all {len(events_for_batch)} filtered events in one batch.")


    # --- OpenAI Formatting ---
    format_start_time = time.time()
    formatted_events_str, num_events_sent_to_openai, openai_error = format_events_with_openai(events_for_batch)
    format_time = time.time() - format_start_time
    print(f"⏱️ OpenAI Formatting took {format_time:.2f} seconds.")

    if openai_error:
         return jsonify({"status": "error", "message": openai_error, "step": "openai_call"}), 500
    
    t_end = time.time()
    print(f"⏱ Total /events handler took {t_end - t_start:.2f}s")

    # --- Process Response ---
    parsed_json = None
    if formatted_events_str:
        # print("\n--- Formatted Events (Raw String from OpenAI) ---") # Avoid printing large strings to console in web service
        # print(formatted_events_str)
        # print("--- End Raw String ---")

        # --- Attempt to Parse and Validate ---
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

                # --- Add a simple urgency check/sort fallback ---
                # The LLM is asked to provide urgency and sort, but we can add a basic
                # check/sort here based on the LLM's 'parsed_date' and 'urgency' fields
                # as a safeguard or alternative sorting if needed.
                today = date.today()
                for event in parsed_json:
                     # Recalculate urgency based on LLM's parsed_date as a check/fallback
                     # This requires parsing LLM's parsed_date format.
                     llm_parsed_date_str = event.get('parsed_date')
                     if llm_parsed_date_str:
                         try:
                             # Attempt to parse LLM's parsed_date format "Mon, May 5, 2025" or "May 15, 2025" etc.
                             # This is still a simplification; a robust date parser is recommended.
                             date_part = llm_parsed_date_str.split(' - ')[0] # Take the start date if it's a range
                             event_date_obj = None
                             for fmt in ["%a, %b %d, %Y", "%b %d, %Y"]:
                                 try:
                                     event_date_obj = datetime.strptime(date_part, fmt).date()
                                     break
                                 except ValueError:
                                     continue

                             if event_date_obj:
                                 delta = event_date_obj - today
                                 if 0 <= delta.days <= 3:
                                     event['calculated_urgency_check'] = 'high'
                                 elif 3 < delta.days <= 7:
                                     event['calculated_urgency_check'] = 'medium'
                                 else:
                                     event['calculated_urgency_check'] = 'low'
                             else:
                                event['calculated_urgency_check'] = 'low' # Could not parse LLM's date for check
                                print(f"⚠️ Could not parse LLM's parsed_date '{llm_parsed_date_str}' for urgency check.")

                         except Exception as e:
                             print(f"⚠️ Error during post-LLM urgency calculation for '{llm_parsed_date_str}': {e}")
                             event['calculated_urgency_check'] = 'low' # Default on error

                # Optional: Re-sort the list based on urgency and parsed_date
                # This is a simple sort and might not handle date ranges perfectly.
                urgency_order = {'high': 0, 'medium': 1, 'low': 2}
                def sort_key(event):
                    #  urgency_val = urgency_order.get(event.get('urgency', 'low'), 2)
                    #  # Try to parse date for sorting (using LLM's parsed_date)
                    #  date_val = datetime.max.date() # Default to future if parsing fails
                    #  llm_parsed_date_str = event.get('parsed_date')
                    #  if llm_parsed_date_str:
                    #       try:
                    #           date_part = llm_parsed_date_str.split(' - ')[0]
                    #           # Attempt to parse common formats
                    #           for fmt in ["%a, %b %d, %Y", "%b %d, %Y"]:
                    #               try:
                    #                   date_val = datetime.strptime(date_part, fmt).date()
                    #                   break
                    #               except ValueError:
                    #                   continue
                    #       except Exception:
                    #          pass # Keep default date_val if parsing fails

                    #  return (urgency_val, date_val)

                 parsed_json.sort(key=sort_key)
                print("✅ Sorted events by urgency and date.")
                # --- End urgency check/sort fallback ---


            elif isinstance(parsed_json, dict):
                print("\n⚠️ WARNING: Parsed response is a JSON dictionary, not a list as requested.")
                found_list = False
                # Attempt to find a list within the dictionary
                for key, value in parsed_json.items():
                    if isinstance(value, list):
                        print(f"   Found a list under the key '{key}'. Using this list.")
                        parsed_json = value
                        num_events_received_from_openai = len(parsed_json)
                        found_list = True
                        if num_events_received_from_openai != num_events_sent_to_openai:
                             print(f"   ⚠️ WARNING: Sent {num_events_sent_to_openai} events to OpenAI, but received {num_events_received_from_openai} events back in the nested list!")
                        # Re-sort the extracted list (see sorting logic above)
                        urgency_order = {'high': 0, 'medium': 1, 'low': 2}
                        def sort_key(event):
                             urgency_val = urgency_order.get(event.get('urgency', 'low'), 2)
                             date_val = datetime.max.date()
                             llm_parsed_date_str = event.get('parsed_date')
                             if llm_parsed_date_str:
                                  try:
                                      date_part = llm_parsed_date_str.split(' - ')[0]
                                      for fmt in ["%a, %b %d, %Y", "%b %d, %Y"]:
                                          try:
                                              date_val = datetime.strptime(date_part, fmt).date()
                                              break
                                          except ValueError:
                                              continue
                                  except Exception:
                                     pass
                             return (urgency_val, date_val)
                        parsed_json.sort(key=sort_key)
                        print("✅ Sorted events by urgency and date.")
                        break # Stop searching after finding the first list

                if not found_list:
                    print("   Could not find a list within the dictionary response. Returning the dictionary as-is.")
                    # parsed_json remains the dictionary
                    pass # No sorting applied if not a list

            else:
                print("\n⚠️ WARNING: Parsed response is valid JSON, but not a list or dictionary.")
                print(parsed_json) # Print unexpected structure
                return jsonify({
                    "status": "error",
                    "message": "OpenAI returned valid JSON, but it was not a list or dictionary as expected.",
                    "raw_response": formatted_events_str
                }), 500

        except json.JSONDecodeError as json_err:
            print(f"\n❌❌❌ FAILED TO PARSE OPENAI RESPONSE AS JSON: {json_err}")
            print("   The raw string received is printed above ('Raw String from OpenAI'). Check it carefully for errors or truncation.")
            return jsonify({
                "status": "error",
                "message": f"Failed to parse OpenAI response as JSON: {json_err}",
                "raw_response": formatted_events_str
            }), 500
        except Exception as parse_err:
             print(f"\n❌ An error occurred processing the OpenAI JSON response: {parse_err}")
             traceback.print_exc()
             return jsonify({
                 "status": "error",
                 "message": f"An error occurred processing the OpenAI JSON response: {parse_err}",
                 "raw_response": formatted_events_str # Include raw response for debugging
             }), 500

    else:
        print("\n❌ Failed to get formatted events string from OpenAI function.")
        return jsonify({
            "status": "error",
            "message": "OpenAI formatting function did not return a valid response string.",
            "step": "openai_call_result"
        }), 500

    total_time = time.time() - total_start_time
    print(f"\n🏁 Request finished in {total_time:.2f} seconds.")

    # Return the parsed and potentially re-sorted JSON
    return jsonify({
        "status": "success",
        "message": f"Successfully scraped and formatted {len(parsed_json) if isinstance(parsed_json, list) else 'N/A'} events.",
        "total_scraped": len(raw_events),
        "filtered_for_formatting": len(filtered_events),
        "sent_to_openai": num_events_sent_to_openai,
        "received_from_openai": num_events_received_from_openai if isinstance(parsed_json, list) else "N/A",
        "events": parsed_json # This will be the list or potentially the dictionary if list wasn't found
    })


# --- Main execution block for Flask ---
if __name__ == "__main__":
    # Ensure required libraries are installed:
    # pip install requests beautifulsoup4 python-dotenv openai lxml Flask
    print("Starting Flask server...")
    # Use debug=True for development, remove for production
    app.run(debug=True, port=5000) # You can change the port if needed