#!/usr/bin/env python3
"""Build a single-file copy of one trip that works offline and when opened straight from a phone or laptop.

    python3 tools/build_standalone.py japan-2026

Writes dist/japan-2026.html with the styles, the map library, the app and the trip data all inside one file.
The normal site (index.html on GitHub Pages) does not need this - it reads the CSV files directly.
Uses only the Python standard library.
"""
import csv, io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda p: open(os.path.join(ROOT, p), encoding="utf-8-sig").read()


def num(v):
    s = str(v or "").replace(",", "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def to_stop(r, day, maybe):
    g = lambda k: (r.get(k) or "").strip()
    split = lambda v, sep: [x.strip() for x in v.split(sep) if x.strip()]
    order = num(g("day_order"))
    return {
        "n": g("Name"), "city": g("City") + (f" · {g('Neighborhood')}" if g("Neighborhood") else ""),
        "cat": g("Category"), "h": g("Hours"), "note": g("Description"),
        "lat": num(g("Latitude")), "lng": num(g("Longitude")), "tags": split(g("Tags"), ";"),
        "must": g("Must See Flag").lower() == "yes", "meal": split(g("Meal Time"), "/"),
        "bestTime": g("Best Time To Visit"), "price": g("Price"), "highlight": g("Must See Highlight"),
        "reservation": g("Reservation Info"), "mapsLink": g("Google Maps Link"),
        "tabelog": g("Review Link") or g("Tabelog Link"), "ig": g("Instagram"), "website": g("Website"),
        "day_order": 999 if order is None else order, "d": day, "maybe": maybe,
        "priorityStatus": g("Priority Status"),
    }


def build_data(trip):
    """Same rules as build() in app/data-loader.js."""
    rows = [r for r in csv.DictReader(io.StringIO(read(f"trips/{trip}/stops.csv"))) if (r.get("Name") or "").strip()]
    days = list(csv.DictReader(io.StringIO(read(f"trips/{trip}/days.csv"))))
    meta = {str(int(num(d["Day"]))): {"city": (d.get("City") or "").strip(), "type": (d.get("Type") or "").strip()}
            for d in days if num(d.get("Day")) is not None}
    stops = [to_stop(r, int(num(r["Day"])), False) for r in rows if num(r.get("Day")) is not None]
    stops += [to_stop(r, int(num(r["Potential Day"])), True) for r in rows if num(r.get("Potential Day")) is not None]
    for r in rows:
        if num(r.get("Day")) is None and num(r.get("Potential Day")) is None and (r.get("Category") or "").strip().lower() != "restroom":
            s = to_stop(r, -1, True)
            s["d"] = None
            stops.append(s)
    if not meta or not stops:
        sys.exit("No days or no stops found - check the CSV files.")
    return {"meta": meta, "stops": stops}


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r"[A-Za-z0-9_-]+", sys.argv[1]):
        sys.exit("Usage: python3 tools/build_standalone.py <trip-folder-name>")
    trip = sys.argv[1]
    if not os.path.isdir(os.path.join(ROOT, "trips", trip)):
        sys.exit(f"There is no folder trips/{trip}")
    html = read("index.html")
    safe = lambda js: js.replace("</script", "<\\/script")

    def swap(tag, replacement):
        nonlocal html
        if tag not in html:
            sys.exit(f"index.html no longer contains {tag} - update tools/build_standalone.py to match.")
        html = html.replace(tag, replacement)

    swap('<link rel="stylesheet" href="app/vendor/leaflet.css">', "<style>\n" + read("app/vendor/leaflet.css") + "</style>")
    swap('<link rel="stylesheet" href="app/styles.css">', "<style>\n" + read("app/styles.css") + "</style>")
    swap('<script src="app/vendor/leaflet.js"></script>', "<script>\n" + safe(read("app/vendor/leaflet.js")) + "</script>")
    data = json.dumps(build_data(trip), ensure_ascii=False).replace("</", "<\\/")
    swap('<script src="trips/trips.js"></script>',
         f'<script>\nwindow.TRIPS = {{default: {json.dumps(trip)}, list: [{{id: {json.dumps(trip)}}}]}};\n'
         f'window.TRIP_ID = {json.dumps(trip)};\n</script>\n'
         "<script>\n" + safe(read(f"trips/{trip}/trip.config.js")) + "</script>\n"
         "<script>\nwindow.__ITIN__ = " + data + ";\n</script>")
    swap('<script src="app/boot.js"></script>',
         '<script type="text/plain" id="appScript">\n' + safe(read("app/app.js")) + "</script>\n"
         "<script>\n" + safe(read("app/data-loader.js")) + "</script>")
    os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
    out = os.path.join(ROOT, "dist", f"{trip}.html")
    open(out, "w", encoding="utf-8").write(html)
    print(f"Wrote dist/{trip}.html ({os.path.getsize(out) // 1024} KB)")


if __name__ == "__main__":
    main()
