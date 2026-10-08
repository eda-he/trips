# Trip Itinerary

A phone-friendly itinerary page: a map on top, a day-by-day list of stops underneath, with search, category filters and a "mark visited" tick on every stop. It is hosted free on GitHub Pages.

The page is a reusable template. Each trip is a folder of plain data files, and one repo can hold many trips. Old trips stay available after you add new ones; the link decides which trip opens.

- Default trip: `https://<your-username>.github.io/<repo-name>/`
- A specific trip: `https://<your-username>.github.io/<repo-name>/?trip=japan-2026`

The value after `?trip=` is the name of that trip's folder under `trips/`.

## What is in the repo

```
index.html                  The page shell. Never needs editing.
README.md                   This file.

app/                        The reusable template. Shared by every trip.
  boot.js                   Reads ?trip= from the link and picks the trip.
  data-loader.js            Reads the trip's CSV files (or Google Sheet) and prepares the data.
  app.js                    Draws the page: days, stop cards, filters, search, map, visited ticks.
  styles.css                Colours, fonts and layout.
  vendor/                   Leaflet, the map library. Leave as is.

trips/                      One folder per trip. This is where your content lives.
  trips.js                  The list of trips, and which one is the default.
  japan-2026/               A trip. The folder name is the value used in ?trip=
    trip.config.js          Title, dates, map start point, currency symbol, optional Google Sheet links.
    stops.csv               Every stop, one row each.
    days.csv                The title and type of each day.
  template/                 A blank trip to copy when you start a new one.

tools/                      Optional helpers. The site works without them.
  build_standalone.py       Makes a single-file copy of a trip that works offline.
  make_sheet.py             Makes an Excel copy of a trip's data for Google Sheets.
```

Rule of thumb: **for a trip, you only touch files inside `trips/`.** Everything in `app/` is the template.

## How the files tie together

When someone opens the page, this happens in order:

1. **`index.html`** loads the styles, the map library, `trips/trips.js` and `app/boot.js`.
2. **`app/boot.js`** reads `?trip=` from the link. With no value it uses the `default` in `trips/trips.js`. If the value is not in that list, it shows a list of trips to choose from.
3. Boot loads that trip's **`trip.config.js`** (the header text and settings), then **`app/data-loader.js`**.
4. **`app/data-loader.js`** gets the data, trying these in order:
   1. the Google Sheet, if the trip's config has both links filled in;
   2. `stops.csv` and `days.csv` in the trip's folder;
   3. the last copy this device loaded, so the page still opens with no signal.
5. The loader hands the data to **`app/app.js`**, which draws everything.

So a change to `stops.csv` shows up the next time the page is loaded. There is no build step.

## Put it on GitHub Pages

1. Create a GitHub account and a new **public** repository (for example `trips`).
2. On the repository page choose **Add file → Upload files**. Drag in everything inside this folder, including the `app`, `trips` and `tools` folders, so that `index.html` sits at the top level. Commit.
3. Go to **Settings → Pages**. Under "Build and deployment" pick **Deploy from a branch**, branch **main**, folder **/ (root)**, and save.
4. After a minute or two the page is live at `https://<your-username>.github.io/<repo-name>/`.

Add the page to your phone's home screen from the browser's share menu for one-tap access.

## Update a trip

There are two ways to keep a trip's data. Pick one per trip.

**A. Edit the CSV files in the repo (default).**
Open `trips/<trip>/stops.csv` on GitHub, click the pencil, change it, commit. Or edit the file in Excel/Numbers/Google Sheets on your computer, save as CSV, and upload it over the old one. Reload the page to see the change.

**B. Edit a Google Sheet.**
Put the stops in one tab and the days in another, with the same column headers as the CSV files. For each tab use **File → Share → Publish to web → (the tab) → Comma-separated values (.csv) → Publish**, and paste the two links into `googleSheet` in the trip's `trip.config.js`. From then on, edits in the sheet appear on the page within a few minutes, with no upload. The CSV files in the repo remain the fallback if the sheet can't be reached, so refresh them now and then.

The small grey line under the page title always says where the data came from and when.

### `days.csv`

One row per day.

| Column | Meaning |
|---|---|
| `Day` | The day's number. Any whole numbers work: 1, 2, 3… or calendar dates such as 8–27. |
| `City` | The day's heading. The part before the first ` · ` is treated as the city, which decides where spare ideas are listed. |
| `Type` | A small tag beside the heading, for example `stay`, `daytrip` or `transit`. |

### `stops.csv`

One row per stop. The page finds columns by their header name, so the order of columns does not matter, extra columns are ignored, and a missing column is simply left blank. Do not rename the headers below.

| Column | Meaning |
|---|---|
| `Day` | The day the stop is scheduled on. |
| `Potential Day` | For an optional stop: the day it is shown under, greyed, without a step number. Leave `Day` empty. |
| `day_order` | Position within the day: 1, 2, 3… Renumber the day after you insert, remove or move a stop. |
| `Priority Status` | Blank, `PRIORITY`, `BACKUP #1`, `BACKUP #2` or `ALTERNATIVE`. `PRIORITY` and `BACKUP` show as badges. |
| `Name` | The stop's name. |
| `City`, `Neighborhood` | Shown under the name. |
| `Category` | Drives the filter chips and the card colour: restaurant, snacks/sweets, cafe, attraction, temple/shrine, garden/park, shopping, craft workshop, market. Anything else counts as attraction. Rows with category `restroom` only appear if they have a day. |
| `Hours` | Free text. |
| `Description` | The main note on the card. |
| `Meal Time` | Pills such as `breakfast / lunch`. Separate several with `/`. |
| `Best Time To Visit` | Free text: a time, or a note on how it fits the day. |
| `Price` | Free text. The trip's currency symbol is shown in front. |
| `Tags` | Small labels. Separate several with `;`. |
| `Must See Flag` | `Yes` gives the stop a star and a red map pin. |
| `Must See Highlight` | One line shown with a star. |
| `Reservation Info` | Booking status or how to book. Shown with a calendar icon. |
| `Latitude`, `Longitude` | The map pin. Without them the stop is listed but not mapped. |
| `Google Maps Link` | The "Open in Maps" link. If empty, the page searches Maps for the name and city. |
| `Review Link` (or `Tabelog Link`) | A second link on the card. Its label comes from `reviewLink` in the trip's config. |
| `Instagram`, `Website` | Kept with the data; not shown on the page at present. |

A stop with neither `Day` nor `Potential Day` is a spare idea. It appears in a "More to explore in &lt;City&gt;" section after that city's last day.

### A worked example

This row in `stops.csv` (other columns left empty):

| Day | day_order | Priority Status | Name | City | Neighborhood | Category | Hours | Meal Time | Tags | Reservation Info |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 | 3 | PRIORITY | Renkon | Tokyo | Ueno | Restaurant | 17:00-23:00 | dinner | izakaya; vegetables | Not booked yet |

becomes the third card under Day 8: a step badge "3", a "★ PRIORITY" badge, the name, then "Tokyo · Ueno · 🕒 17:00-23:00", a "dinner" pill, two tag pills, and a calendar line "Not booked yet". With `Latitude` and `Longitude` filled in, it also gets a map pin and its name becomes tappable.

Move `8` from `Day` to `Potential Day` and the same card shows greyed, with no step number, as an optional stop for Day 8. Clear both and it moves to "More to explore in Tokyo".

### `trip.config.js`

Plain text settings, each with a comment in the file:

- the browser tab title, header title, dates and route line;
- where the map starts, the currency symbol, the label for the review link;
- optional: Google Sheet links, a footer note, your own filter chips, and a `theme` block that gives this trip its own colours and fonts.

## Add a new trip (and keep the old ones)

1. Copy the folder `trips/template` and rename the copy, for example `trips/italy-2027`. Use only letters, numbers, dashes and underscores. This name is what goes after `?trip=`.
2. Edit `trip.config.js` in the new folder.
3. Replace the example rows in `stops.csv` and `days.csv` with your own.
4. Open `trips/trips.js` and add a line for the trip:
   ```js
   { id: "italy-2027", name: "Italy 2027", dates: "May 3–17, 2027" }
   ```
   Put a comma after the line above it. Change `default` if the new trip should open when no `?trip=` is given.
5. Upload the new folder and the changed `trips.js`.

Nothing about the old trips changes. `?trip=japan-2026` keeps working, and when the list has more than one trip, each page shows "Other trips" links at the bottom.

To retire a trip from the links but keep its files, remove its line from `trips.js`.

## Optional tools

Both need Python 3 on a computer. Run them from the top folder of the repo. They write into a `dist/` folder.

- `python3 tools/build_standalone.py japan-2026` makes `dist/japan-2026.html`, one file with the page, the map library and the data inside it. Use it when you want a copy that opens straight from your phone's files with no hosting. It is a snapshot: rebuild it after you change the data.
- `python3 tools/make_sheet.py japan-2026` makes `dist/japan-2026.xlsx` with a `stops` tab and a `days` tab, ready to import into Google Sheets. It needs `pip install openpyxl`.

## Things to know

- **The repo is public.** Anyone with the link can read every trip in it, including notes about where you are staying and when. Leave out anything you would not post publicly.
- **Opening `index.html` straight from your computer does not work.** Browsers stop a local page from reading the CSV files. View it through GitHub Pages, or use the single-file build.
- **"Visited" ticks are saved on each device**, separately for each trip. They do not sync between phones.
- **The map tiles need a connection.** The list of stops works offline once the page has loaded once on that device.
- **Trip notes:** you can add a `docs/` folder inside a trip folder for your own notes. The page does not read it. In a public repo it is readable by anyone, so keep booking details and personal notes out of it.

## Change the look

- **For every trip:** edit the colour and font variables at the top of `app/styles.css`.
- **For one trip:** add a `theme` block to that trip's `trip.config.js`. It can override any of those variables and load different fonts. The template config has a commented example.

## If something breaks

| What you see | Cause | Fix |
|---|---|---|
| "There is no trip called …" | The `?trip=` value is not in `trips/trips.js`, or is spelled differently from the folder. | Make the `id` in `trips.js`, the folder name and the link match exactly, including capitals. |
| "Could not load trips/…/trip.config.js" | The folder or file is missing, or the config has a typo. | Check the folder exists. In the config, look for a missing comma or quote. |
| "Could not load the trip data" | The CSV files are missing, or the page was opened from your computer. | Check `stops.csv` and `days.csv` are in the trip folder. View through the hosted link. |
| A blank page after editing a config or `trips.js` | A missing comma, quote or bracket. | Compare with `trips/template/trip.config.js`; undo the last edit. |
| Stops shifted into the wrong columns | A cell contains a comma or a quote and is not wrapped in quotes. | Wrap the cell in double quotes; write a quote inside it as two quotes (`""`). Spreadsheet apps do this for you on export. |
| A stop is missing | `Day` and `Potential Day` are both empty and its `City` matches no day's city. | Give it a `Day` or `Potential Day`, or match the city name used in `days.csv`. |
| A stop has no map pin | `Latitude` or `Longitude` is empty or not a number. | Fill in both as plain numbers, for example `35.7099` and `139.7742`. |
| Changes don't appear | The browser is showing a saved copy, or GitHub Pages is still publishing. | Wait a minute and reload. The grey line under the title shows when the data was loaded. |

## Change what a card shows

`toStop()` in `app/data-loader.js` is the one place that turns a CSV row into a stop. `stopCardHtml()` in `app/app.js` is the one place that turns a stop into a card. To show a new column, add it in both. `tools/build_standalone.py` has a matching `to_stop()` for the single-file build.
