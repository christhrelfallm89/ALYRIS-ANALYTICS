from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parent.parent
HISTORY_PATH = REPO_ROOT / "data" / "history.json"
WEBHOOK_ENV = "DISCORD_WEBHOOK_URL"

METRIC_LABELS = {
    "totalStreams": "Total Streams",
    "totalFollowers": "Total Followers",
    "instagramFollowers": "Instagram Followers",
    "tiktokFollowers": "TikTok Followers",
    "youtubeSubscribers": "YouTube Subscribers",
    "youtubeViews": "YouTube Views",
    "spotifyFollowers": "Spotify Followers",
    "spotifyMonthlyListeners": "Spotify Monthly Listeners",
    "facebookFollowers": "Facebook Followers",
}


def read_history() -> dict:
    if not HISTORY_PATH.exists():
        raise FileNotFoundError(f"Missing history file: {HISTORY_PATH}")
    return json.loads(HISTORY_PATH.read_text(encoding="utf-8"))


def format_number(value: int | float | None) -> str:
    if value is None:
        return "—"
    return f"{value:,}"


def format_delta(current: int | None, previous: int | None) -> tuple[str, str]:
    if current is None or previous is None:
        return "⚪", "n/a"

    delta = current - previous
    if previous > 0:
        pct = (delta / previous) * 100
        pct_text = f"{pct:+.1f}%"
    else:
        pct_text = "n/a"

    if delta > 0:
        icon = "🟢"
    elif delta < 0:
        icon = "🔴"
    else:
        icon = "⚪"

    return icon, f"{delta:+,} ({pct_text})"


def build_report_lines(history: dict) -> list[str]:
    snapshots = history.get("snapshots", [])
    if not snapshots:
        return ["No snapshots available yet."]

    latest = snapshots[-1]
    previous = snapshots[-2] if len(snapshots) > 1 else None

    date_label = latest.get("date", datetime.now(timezone.utc).date().isoformat())
    title = f"📈 ALYRIS Daily Growth Report — {date_label}"
    lines = [title]

    if previous:
        lines.append(f"Compared to {previous.get('date', 'previous snapshot')}")
    else:
        lines.append("Compared to previous snapshot: not available yet")

    latest_metrics = latest.get("metrics", {})
    previous_metrics = previous.get("metrics", {}) if previous else {}

    for key, label in METRIC_LABELS.items():
        current_value = latest_metrics.get(key)
        previous_value = previous_metrics.get(key)
        icon, delta_text = format_delta(current_value, previous_value)
        lines.append(f"{icon} {label}: {format_number(current_value)} · {delta_text}")

    top_cities = latest.get("topCities") or []
    if top_cities:
        lines.append(f"🌍 Top Cities: {', '.join(top_cities)}")

    last_updated = latest.get("lastUpdated")
    if last_updated:
        lines.append(f"🕒 Sheet Last Updated: {last_updated}")

    return lines


def send_to_discord(webhook_url: str, content: str) -> None:
    payload = {"content": content[:1900]}
    body = json.dumps(payload).encode("utf-8")
    request = Request(
        webhook_url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request) as response:
        status = getattr(response, "status", None)
        if status and status >= 400:
            raise RuntimeError(f"Discord webhook failed with status {status}")


def main() -> None:
    webhook_url = os.environ.get(WEBHOOK_ENV, "").strip()
    if not webhook_url:
        print(f"{WEBHOOK_ENV} is not set; skipping Discord report.")
        return

    history = read_history()
    lines = build_report_lines(history)
    message = "\n".join(lines)
    send_to_discord(webhook_url, message)
    print("Posted daily growth report to Discord.")


if __name__ == "__main__":
    main()
