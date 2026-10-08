/* Settings for THIS trip. One of these lives in every trip folder; it is the only JavaScript you edit for a trip.
   Everything here is text or a simple value - change what is between the quotes. */
window.TRIP_CONFIG = {

  // Browser tab title
  pageTitle: "My Trip — Itinerary",

  // Header at the top of the page
  title: "My Trip",
  dates: "Mar 1–10 · 10 days",
  subtitle: "City A → City B → City C",

  // Optional: load the data live from a Google Sheet instead of the CSV files.
  // Google Sheet → File → Share → Publish to web → pick the tab → "Comma-separated values (.csv)"
  // → Publish → paste the link here. Do it once for the stops tab and once for the days tab.
  // Leave both empty to use stops.csv and days.csv in this folder.
  googleSheet: {
    stopsCsvUrl: "",
    daysCsvUrl: ""
  },

  // Where the map starts before any pins are drawn: [latitude, longitude] and zoom (2 = world, 6 = country, 12 = city)
  map: { center: [48.86, 2.35], zoom: 6 },

  // Symbol shown in front of the Price column
  currencySymbol: "€",

  // Label for the second link on each stop, filled from the "Review Link" column
  reviewLink: { label: "Reviews", icon: "⭐" }

  // Optional: your own filter chips. Remove the two slashes to use it; without it the defaults below apply.
  // , categories: ["restaurant","snacks/sweets","cafe","attraction","temple/shrine","garden/park","shopping","craft workshop","market"]

  // Optional: a line added to the footer after the stop counts
  // , footerNote: "planned with friends"

  // Optional: extra pages for this trip, such as a packing or shopping list. Put the .html file in this folder;
  // a link to it appears under the header. Add a link back to the itinerary inside that page.
  // , pages: [ { label: "Packing list", file: "packing.html" } ]

  // Optional: this trip's own look. Any colour or font variable at the top of app/styles.css can be set here.
  // Remove the slashes to use it. Without it the shared look applies.
  // , theme: {
  //     colors: { indigo: "#1C3155", "indigo-deep": "#12213B", shu: "#BC4B34", paper: "#EFEAE0" },
  //     fonts:  { display: "'Playfair Display', serif", body: "'Inter', sans-serif",
  //               url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;700&display=swap" }
  //   }
};
