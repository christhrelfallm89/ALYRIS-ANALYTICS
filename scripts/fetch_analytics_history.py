from __future__ import annotations

import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSd-eBeAuYkde8q-AKXvkqR2r0ogPmtJMJ4pzHSBsr2AcqUcBQsQwrpmZ1ecBUxBmzZiMTwn77NoZ-s/pub?output=csv"
REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
HISTORY_PATH = DATA_DIR / "history.json"
LATEST_PATH = DATA_DIR / "latest.json"


def normalize_key(value: str | None) -> str:
    return str(value or "").strip().lower()


def find_header_map(rows: list[list[str]]) -> dict[str, int | None] | None:
    wanted = {
        "platform": "platform name",
        "label": "main stat",
        "value": "number",
        "secondary_label": "secondary stat",
        "last_updated": "last updated",
    }

    for row_index, row in enumerate(rows):
        normalized = [normalize_key(cell) for cell in row]
        idx_platform = normalized.index(wanted["platform"]) if wanted["platform"] in normalized else -1
        idx_label = normalized.index(wanted["label"]) if wanted["label"] in normalized else -1
        number_indices = [index for index, cell in enumerate(normalized) if cell == wanted["value"]]

        if idx_platform != -1 and idx_label != -1 and number_indices:
            idx_secondary_label = normalized.index(wanted["secondary_label"]) if wanted["secondary_label"] in normalized else -1
            idx_last_updated = normalized.index(wanted["last_updated"]) if wanted["last_updated"] in normalized else -1
            return {
                "data_start_index": row_index + 1,
                "idx_platform": idx_platform,
                "idx_label": idx_label,
                "idx_value": number_indices[0],
                "idx_secondary_label": None if idx_secondary_label == -1 else idx_secondary_label,
                "idx_secondary_value": number_indices[1] if len(number_indices) > 1 else None,
                "idx_last_updated": None if idx_last_updated == -1 else idx_last_updated,
            }

    return None


def row_to_stat(row: list[str], mapping: dict[str, int | None]) -> dict[str, str]:
    idx_platform = int(mapping["idx_platform"] or 0)
    idx_label = int(mapping["idx_label"] or 1)
    idx_value = int(mapping["idx_value"] or 2)
    idx_secondary_label = mapping["idx_secondary_label"]
    idx_secondary_value = mapping["idx_secondary_value"]
    idx_last_updated = mapping["idx_last_updated"]

    return {
        "platform": (row[idx_platform] if idx_platform < len(row) else "") or (row[0] if row else ""),
        "label": row[idx_label] if idx_label < len(row) else "",
        "value": row[idx_value] if idx_value < len(row) else "",
        "secondaryLabel": row[idx_secondary_label] if idx_secondary_label is not None and idx_secondary_label < len(row) else "",
        "secondaryValue": row[idx_secondary_value] if idx_secondary_value is not None and idx_secondary_value < len(row) else "",
        "lastUpdated": row[idx_last_updated] if idx_last_updated is not None and idx_last_updated < len(row) else "",
    }


def matches_alias(platform_name: str, canonical_key: str) -> bool:
    normalized = normalize_key(platform_name)
    aliases = {
        "instagram": ["ig", "instagram"],
        "tiktok": ["tiktok", "tik tok"],
        "youtube": ["youtube", "yt"],
        "facebook": ["facebook", "fb"],
        "spotify": ["spotify"],
    }.get(canonical_key, [canonical_key])
    return any(normalized == alias for alias in aliases)


def includes_any(text: str, needles: list[str]) -> bool:
    normalized = normalize_key(text)
    return any(normalize_key(needle) in normalized for needle in needles)


def to_number(raw_value: str | None) -> int | None:
    cleaned = str(raw_value or "").replace(",", "").strip()
    if not cleaned:
        return None
    try:
        return int(float(cleaned))
    except ValueError:
        return None


def parse_spotify_top_cities(raw_text: str, max_items: int = 3) -> list[str]:
    return re.findall(r'"city"\s*:\s*"([^"]+)"', raw_text or "")[:max_items]


def pick_last_updated(stats: list[dict[str, str]]) -> str | None:
    timestamps = [row["lastUpdated"].strip() for row in stats if row.get("lastUpdated", "").strip()]
    if not timestamps:
        return None
    return max(timestamps)


def build_metrics(stats: list[dict[str, str]]) -> dict[str, int | None]:
    instagram = next((row for row in stats if matches_alias(row["platform"], "instagram")), None)
    tiktok = next((row for row in stats if matches_alias(row["platform"], "tiktok")), None)
    youtube = next((row for row in stats if matches_alias(row["platform"], "youtube")), None)
    spotify = next((row for row in stats if matches_alias(row["platform"], "spotify")), None)
    facebook = next((row for row in stats if matches_alias(row["platform"], "facebook")), None)
    total_followers = next((row for row in stats if includes_any(row["platform"], ["total followers"])), None)
    total_streams = next((row for row in stats if includes_any(row["platform"], ["total streams"])), None)

    return {
        "totalStreams": to_number(total_streams["value"] if total_streams else None),
        "totalFollowers": to_number(total_followers["value"] if total_followers else None),
        "instagramFollowers": to_number(instagram["value"] if instagram else None),
        "tiktokFollowers": to_number(tiktok["value"] if tiktok else None),
        "youtubeSubscribers": to_number(youtube["value"] if youtube else None),
        "youtubeViews": to_number(youtube["secondaryValue"] if youtube else None),
        "spotifyFollowers": to_number(spotify["value"] if spotify else None),
        "spotifyMonthlyListeners": to_number(spotify["secondaryValue"] if spotify else None),
        "facebookFollowers": to_number(facebook["value"] if facebook else None),
    }


def read_json(path: Path, fallback: dict) -> dict:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    csv_text = urlopen(SHEET_CSV_URL).read().decode("utf-8")
    rows = list(csv.reader(csv_text.splitlines()))
    header_map = find_header_map(rows)
    if not header_map:
        raise RuntimeError("Could not locate the analytics header row in the published sheet.")

    stats = [
        row_to_stat(row, header_map)
        for row in rows[int(header_map["data_start_index"]):]
        if any(str(cell).strip() for cell in row)
    ]

    top_cities_raw = rows[5][8] if len(rows) > 5 and len(rows[5]) > 8 else ""
    now = datetime.now(timezone.utc)
    snapshot = {
        "date": now.date().isoformat(),
        "capturedAt": now.isoformat().replace("+00:00", "Z"),
        "lastUpdated": pick_last_updated(stats),
        "topCities": parse_spotify_top_cities(top_cities_raw, 3),
        "metrics": build_metrics(stats),
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    history = read_json(
        HISTORY_PATH,
        {
            "sheetCsvUrl": SHEET_CSV_URL,
            "updatedAt": None,
            "snapshotCount": 0,
            "snapshots": [],
        },
    )

    snapshots = history.get("snapshots", [])
    existing_index = next((index for index, item in enumerate(snapshots) if item.get("date") == snapshot["date"]), None)
    if existing_index is None:
        snapshots.append(snapshot)
    else:
        snapshots[existing_index] = snapshot

    snapshots.sort(key=lambda item: item.get("date", ""))
    history = {
        "sheetCsvUrl": SHEET_CSV_URL,
        "updatedAt": snapshot["capturedAt"],
        "snapshotCount": len(snapshots),
        "snapshots": snapshots,
    }

    HISTORY_PATH.write_text(f"{json.dumps(history, indent=2)}\n", encoding="utf-8")
    LATEST_PATH.write_text(f"{json.dumps(snapshot, indent=2)}\n", encoding="utf-8")
    print(f"Stored snapshot for {snapshot['date']} with {len(snapshot['metrics'])} metrics.")


if __name__ == "__main__":
    main()
