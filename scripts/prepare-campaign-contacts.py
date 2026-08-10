#!/usr/bin/env python3
import argparse
import csv
import re
from pathlib import Path

import pandas as pd


HONORIFICS = {"HON", "HON.", "MR", "MR.", "MRS", "MRS.", "DR", "DR.", "REV", "REV."}


def normalize_phone(value):
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) == 9:
        return "+233" + digits
    if len(digits) == 10 and digits.startswith("0"):
        return "+233" + digits[1:]
    if len(digits) == 12 and digits.startswith("233"):
        return "+" + digits
    return ""


def split_name(register_name, fallback):
    register = str(register_name or "").strip()
    if "," in register:
        surname, other_names = register.split(",", 1)
        first = " ".join(other_names.split())
        last = " ".join(surname.split())
        if first:
            return first, last
    tokens = [token for token in str(fallback or "").split() if token.upper() not in HONORIFICS]
    if not tokens:
        return "", ""
    return " ".join(tokens[:-1]) or tokens[0], tokens[-1] if len(tokens) > 1 else ""


def clean_text(value):
    if pd.isna(value):
        return ""
    return " ".join(str(value).strip().split())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_xlsx", type=Path)
    parser.add_argument("output_csv", type=Path)
    args = parser.parse_args()

    frame = pd.read_excel(args.input_xlsx, sheet_name="DOB Matches", header=3, dtype=object)
    frame = frame[frame["DOB Match Status"] == "Matched by exact Voter ID"].copy()

    records = []
    invalid_phone = 0
    duplicate_phone = 0
    seen_phones = set()
    for _, row in frame.iterrows():
        phone = normalize_phone(row.get("Contact"))
        if not phone:
            invalid_phone += 1
            continue
        if phone in seen_phones:
            duplicate_phone += 1
            continue
        seen_phones.add(phone)
        first_name, last_name = split_name(row.get("Voter Register Name"), row.get("Name"))
        dob = row.get("Date of Birth")
        dob_text = dob.strftime("%Y-%m-%d") if hasattr(dob, "strftime") else clean_text(dob)
        records.append({
            "first_name": first_name,
            "last_name": last_name,
            "phone_number": phone,
            "date_of_birth": dob_text,
            "voter_id": clean_text(row.get("Voter ID")),
            "polling_station_code": clean_text(row.get("Voter Polling Station Code")),
            "region": clean_text(row.get("Region")),
            "constituency": clean_text(row.get("Constituency")),
            "source_name": clean_text(row.get("Name")),
        })

    args.output_csv.parent.mkdir(parents=True, exist_ok=True)
    with args.output_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(records[0].keys()) if records else [])
        if records:
            writer.writeheader()
            writer.writerows(records)

    print({
        "eligible_dob_rows": len(frame),
        "prepared_contacts": len(records),
        "invalid_phone": invalid_phone,
        "duplicate_phone": duplicate_phone,
        "output": str(args.output_csv),
    })


if __name__ == "__main__":
    main()
