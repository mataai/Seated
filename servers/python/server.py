"""Runnable example around seats_hub.py.

    uv run server.py                                  # listen on :3030
    SIMULATE_FLOORPLAN=plan.json uv run server.py     # also book seats at random

Publish changes from anywhere with:
    curl -X POST localhost:3030/floorplans/demo/seats \\
      -H 'content-type: application/json' -d '{"changes":{"s-a-1a":"reserved"}}'
"""

# /// script
# requires-python = ">=3.10"
# dependencies = ["python-socketio>=5.11,<6", "uvicorn>=0.30"]
# ///

from __future__ import annotations

import asyncio
import json
import os
import random
import re
from urllib.parse import unquote

import socketio
import uvicorn

from seats_hub import SeatsHub

PORT = int(os.environ.get("PORT", "3030"))
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*")

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=CORS_ORIGIN)
# Replace with a real check, e.g. verify auth["token"].
hub = SeatsHub(sio, authorize=lambda environ, auth, floorplan_id: True)

PUBLISH_PATH = re.compile(r"^/floorplans/([^/]+)/seats$")
CORS_HEADERS = [
    (b"access-control-allow-origin", CORS_ORIGIN.encode()),
    (b"access-control-allow-methods", b"POST, OPTIONS"),
    (b"access-control-allow-headers", b"content-type"),
]


async def http_app(scope, receive, send):
    """Minimal ASGI app for POST /floorplans/<id>/seats {"changes": {...}}."""
    if scope["type"] != "http":
        return
    match = PUBLISH_PATH.match(scope["path"])
    status, body, headers = 404, b"", []
    if match:
        headers = CORS_HEADERS
        # Browsers send a CORS preflight before a JSON POST from another origin.
        status = 204 if scope["method"] == "OPTIONS" else 405
    if scope["method"] == "POST" and match:
        raw = b""
        while True:
            message = await receive()
            raw += message.get("body", b"")
            if not message.get("more_body"):
                break
        try:
            payload = json.loads(raw)
            if not isinstance(payload, dict):
                raise TypeError("payload must be an object")
            if "changes" not in payload and "data" not in payload:
                raise KeyError("changes")
            rev = await hub.publish(
                unquote(match.group(1)), payload.get("changes"), payload.get("data")
            )
            status, body = 200, json.dumps({"rev": rev}).encode()
        except (ValueError, KeyError, TypeError):
            status = 400
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [*headers, (b"content-type", b"application/json")],
        }
    )
    await send({"type": "http.response.body", "body": body})


app = socketio.ASGIApp(sio, other_asgi_app=http_app)


async def simulate_bookings(floorplan_id: str, floorplan: dict) -> None:
    """Every 2s, books or releases a random seat and reprices another one."""
    seat_ids = [
        seat["id"]
        for building in floorplan["buildings"]
        for row in building["rows"]
        for seat in row["seats"]
    ]
    while True:
        await asyncio.sleep(2)
        seat_id = random.choice(seat_ids)
        _, statuses, _ = await hub.store.get(floorplan_id)
        await hub.publish(
            floorplan_id,
            {seat_id: None if statuses.get(seat_id) == "reserved" else "reserved"},
            {random.choice(seat_ids): {"price": 40 + 5 * random.randrange(20)}},
        )


async def main() -> None:
    server = uvicorn.Server(uvicorn.Config(app, host="0.0.0.0", port=PORT))
    tasks = [server.serve()]
    if os.environ.get("SIMULATE_FLOORPLAN"):
        with open(os.environ["SIMULATE_FLOORPLAN"], encoding="utf-8") as f:
            plan = json.load(f)
        tasks.append(simulate_bookings(os.environ.get("FLOORPLAN_ID", "demo"), plan))
    await asyncio.gather(*tasks)


if __name__ == "__main__":
    asyncio.run(main())
