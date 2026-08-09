#!/usr/bin/env python3
"""Extract the EC Ghana 2024 polling-station PDF into an idempotent D1 migration."""

from __future__ import annotations

import json
import hashlib
import re
import sys
from collections import OrderedDict
from pathlib import Path

import pdfplumber

SOURCE_URL = "https://ec.gov.gh/wp-content/uploads/2024/10/Polling_stations.pdf"
REGION_CODES = {
    "AHAFO": "AH",
    "ASHANTI": "AS",
    "BONO": "BO",
    "BONO EAST": "BE",
    "CENTRAL": "CE",
    "EASTERN": "EA",
    "GREATER ACCRA": "GA",
    "NORTH EAST": "NE",
    "NORTHERN": "NO",
    "OTI": "OT",
    "SAVANNAH": "SA",
    "UPPER EAST": "UE",
    "UPPER WEST": "UW",
    "VOLTA": "VO",
    "WESTERN": "WE",
    "WESTERN NORTH": "WN",
}
CODE_RE = re.compile(r"^[A-Z][0-9]{6}[A-Z]?$")


def display_name(value: str) -> str:
    return " ".join(value.strip().split()).title()


def sql(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def grouped(values: list[tuple[str, ...]], size: int = 100):
    for index in range(0, len(values), size):
        yield values[index : index + size]


def parse(pdf_path: Path, start_page: int = 1, end_page: int | None = None, validate: bool = True):
    stations: list[dict[str, str]] = []
    constituencies: OrderedDict[str, dict[str, str]] = OrderedDict()
    regions: OrderedDict[str, dict[str, str]] = OrderedDict()
    last_constituency_name = ""
    last_region_name = ""

    with pdfplumber.open(pdf_path) as probe:
        total_pages = len(probe.pages)
    end_page = end_page or total_pages

    for chunk_start in range(start_page - 1, end_page, 150):
        chunk_end = min(chunk_start + 150, end_page)
        with pdfplumber.open(pdf_path) as pdf:
          for page_index in range(chunk_start, chunk_end):
            page_number = page_index + 1
            page = pdf.pages[page_index]
            rows: dict[float, list[dict]] = {}
            for word in page.extract_words(keep_blank_chars=False):
                if 125 <= word["top"] <= 560:
                    rows.setdefault(round(float(word["top"]), 1), []).append(word)

            for words in rows.values():
                words.sort(key=lambda item: item["x0"])
                code = next(
                    (item["text"] for item in words if 90 <= item["x0"] < 180 and CODE_RE.match(item["text"])),
                    None,
                )
                if not code:
                    continue
                number_text = "".join(item["text"] for item in words if 60 <= item["x0"] and item["x1"] < 93)
                station_name = " ".join(item["text"] for item in words if 180 <= item["x0"] < 445).strip()
                constituency_name = " ".join(item["text"] for item in words if 445 <= item["x0"] < 565).strip()
                district_guess = " ".join(item["text"] for item in words if 565 <= item["x0"] < 650).strip()
                tail = "".join(item["text"] for item in words if item["x0"] >= 565).upper()
                region_name = next(
                    (name for name in sorted(REGION_CODES, key=len, reverse=True) if tail.endswith(name.replace(" ", ""))),
                    "",
                )
                if not constituency_name:
                    constituency_name = last_constituency_name if last_region_name == region_name else district_guess
                if not station_name or not constituency_name or region_name not in REGION_CODES:
                    raise ValueError(f"Incomplete row on page {page_number}: {code}")

                region_id = f"region:{REGION_CODES[region_name].lower()}"
                constituency_display_name = display_name(constituency_name)
                constituency_key = f"{region_name}|{constituency_display_name}"
                constituency_code = "EC24-" + hashlib.sha1(constituency_key.encode()).hexdigest()[:8].upper()
                constituency_id = f"constituency:{constituency_code.lower()}"
                regions.setdefault(region_name, {
                    "id": region_id,
                    "name": display_name(region_name),
                    "code": REGION_CODES[region_name],
                })
                constituencies.setdefault(constituency_key, {
                    "id": constituency_id,
                    "region_id": region_id,
                    "name": constituency_display_name,
                    "code": constituency_code,
                })
                last_constituency_name = constituency_display_name
                last_region_name = region_name
                stations.append({
                    "row": number_text.replace(",", ""),
                    "id": f"station:{code.lower()}",
                    "constituency_id": constituency_id,
                    "name": station_name,
                    "code": code,
                    "address": None,
                })

            if page_number % 100 == 0:
                print(f"Parsed {page_number}/{total_pages} pages", file=sys.stderr)
            page.close()

    if validate:
        validate_records(list(regions.values()), list(constituencies.values()), stations)
    return list(regions.values()), list(constituencies.values()), stations


def validate_records(regions, constituencies, stations):
    sequence = [int(item["row"]) for item in stations]
    if sequence != list(range(1, len(stations) + 1)):
        raise ValueError("PDF row sequence is incomplete or duplicated")
    if len(regions) != 16:
        raise ValueError(f"Expected 16 regions, found {len(regions)}")
    if len(constituencies) != 276:
        raise ValueError(f"Expected 276 constituencies, found {len(constituencies)}")


def write_migration(output: Path, regions, constituencies, stations):
    statements = [
        "-- Official source: Ghana Electoral Commission, List of Polling Stations for 2024 General Elections",
        f"-- {SOURCE_URL}",
    ]
    region_values = [tuple(item[key] for key in ("id", "name", "code")) for item in regions]
    constituency_values = [tuple(item[key] for key in ("id", "region_id", "name", "code")) for item in constituencies]
    station_values = [tuple(item.get(key) for key in ("id", "constituency_id", "name", "code", "address")) for item in stations]

    for batch in grouped(region_values):
        values = ",\n".join(f"({sql(a)}, {sql(b)}, {sql(c)})" for a, b, c in batch)
        statements.append(f"INSERT INTO regions (id, name, code) VALUES\n{values}\nON CONFLICT(code) DO UPDATE SET name = excluded.name, updated_at = CURRENT_TIMESTAMP;")
    for batch in grouped(constituency_values):
        values = ",\n".join(f"({sql(a)}, {sql(b)}, {sql(c)}, {sql(d)})" for a, b, c, d in batch)
        statements.append(f"INSERT INTO constituencies (id, region_id, name, code) VALUES\n{values}\nON CONFLICT(code) DO UPDATE SET region_id = excluded.region_id, name = excluded.name, updated_at = CURRENT_TIMESTAMP;")
    for batch in grouped(station_values):
        values = ",\n".join(f"({sql(a)}, {sql(b)}, {sql(c)}, {sql(d)}, {sql(e)})" for a, b, c, d, e in batch)
        statements.append(f"INSERT INTO polling_stations (id, constituency_id, name, code, address) VALUES\n{values}\nON CONFLICT(code) DO UPDATE SET constituency_id = excluded.constituency_id, name = excluded.name, address = excluded.address, updated_at = CURRENT_TIMESTAMP;")
    output.write_text("\n--> statement-breakpoint\n".join(statements) + "\n", encoding="utf-8")


def main():
    if len(sys.argv) == 6 and sys.argv[1] == "fragment":
        pdf_path = Path(sys.argv[2])
        regions, constituencies, stations = parse(
            pdf_path, int(sys.argv[3]), int(sys.argv[4]), validate=False
        )
        Path(sys.argv[5]).write_text(json.dumps({
            "regions": regions, "constituencies": constituencies, "stations": stations,
        }), encoding="utf-8")
        print(json.dumps({"pages": [int(sys.argv[3]), int(sys.argv[4])], "stations": len(stations)}))
        return
    if len(sys.argv) < 5 or sys.argv[1] != "combine":
        raise SystemExit("Use 'fragment INPUT.pdf START END OUTPUT.json' or 'combine OUTPUT.sql SUMMARY.json FRAGMENTS...' ")
    sql_path, summary_path = map(Path, sys.argv[2:4])
    region_map: OrderedDict[str, dict] = OrderedDict()
    constituency_map: OrderedDict[str, dict] = OrderedDict()
    stations = []
    for fragment_path in map(Path, sys.argv[4:]):
        fragment = json.loads(fragment_path.read_text(encoding="utf-8"))
        for item in fragment["regions"]:
            region_map[item["code"]] = item
        for item in fragment["constituencies"]:
            constituency_map[item["code"]] = item
        stations.extend(fragment["stations"])
    regions = list(region_map.values())
    constituencies = list(constituency_map.values())
    validate_records(regions, constituencies, stations)
    write_migration(sql_path, regions, constituencies, stations)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps({
        "source": SOURCE_URL,
        "electionYear": 2024,
        "regions": len(regions),
        "constituencies": len(constituencies),
        "pollingStations": len(stations),
        "firstStationCode": stations[0]["code"],
        "lastStationCode": stations[-1]["code"],
    }, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"regions": len(regions), "constituencies": len(constituencies), "pollingStations": len(stations)}))


if __name__ == "__main__":
    main()
