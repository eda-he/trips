#!/usr/bin/env python3
"""Make an Excel copy of one trip's data, with a "stops" tab and a "days" tab, for importing into Google Sheets.

    pip install openpyxl
    python3 tools/make_sheet.py japan-2026

Writes dist/japan-2026.xlsx. The CSV files stay the source of truth - this is only a copy.
"""
import csv, io, os, re, sys

try:
    import openpyxl
except ImportError:
    sys.exit("This tool needs openpyxl:  pip install openpyxl")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NUMERIC = {"Day", "Potential Day", "day_order", "Latitude", "Longitude"}


def cell(header, value):
    if header in NUMERIC and value.strip():
        try:
            n = float(value)
            return int(n) if n.is_integer() and header not in ("Latitude", "Longitude") else n
        except ValueError:
            pass
    return value if value != "" else None


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r"[A-Za-z0-9_-]+", sys.argv[1]):
        sys.exit("Usage: python3 tools/make_sheet.py <trip-folder-name>")
    trip = sys.argv[1]
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for tab in ("stops", "days"):
        path = os.path.join(ROOT, "trips", trip, f"{tab}.csv")
        rows = list(csv.reader(io.StringIO(open(path, encoding="utf-8-sig").read())))
        ws = wb.create_sheet(tab)
        ws.append(rows[0])
        for r in rows[1:]:
            ws.append([cell(h, v) for h, v in zip(rows[0], r)])
        ws.freeze_panes = "A2"
    os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
    out = os.path.join(ROOT, "dist", f"{trip}.xlsx")
    wb.save(out)
    print(f"Wrote dist/{trip}.xlsx")


if __name__ == "__main__":
    main()
