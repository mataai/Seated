"""OpenSeats live seat updates: reference Socket.IO server (Python).

Copy this file into your backend and adapt it. It implements the protocol in
../protocol.md and nothing else: who may connect, where statuses are stored
and when seats change are decided by your app.
"""

from __future__ import annotations

import inspect
from typing import Any, Awaitable, Callable, Optional, Union

import socketio

PROTOCOL_VERSION = 1
SYNC_EVENT = "seats:sync"
PATCH_EVENT = "seats:patch"

Changes = dict[str, Optional[str]]
Authorize = Callable[[dict, dict, str], Union[bool, Awaitable[bool]]]


def room_for(floorplan_id: str) -> str:
    return f"floorplan:{floorplan_id}"


class MemoryStore:
    """In-memory store, one entry per floorplan.

    Replace with your database; keep `get` and `apply` atomic so a snapshot's
    `rev` matches its `statuses`.
    """

    def __init__(self, initial: Optional[dict[str, dict[str, str]]] = None):
        self._floorplans: dict[str, dict[str, Any]] = {
            fid: {"rev": 0, "statuses": dict(statuses)}
            for fid, statuses in (initial or {}).items()
        }

    def _entry(self, floorplan_id: str) -> dict[str, Any]:
        return self._floorplans.setdefault(floorplan_id, {"rev": 0, "statuses": {}})

    async def get(self, floorplan_id: str) -> tuple[int, dict[str, str]]:
        entry = self._entry(floorplan_id)
        return entry["rev"], dict(entry["statuses"])

    async def apply(self, floorplan_id: str, changes: Changes) -> int:
        """Applies changes (`None` resets a seat) and returns the new revision."""
        entry = self._entry(floorplan_id)
        for seat_id, status in changes.items():
            if status is None:
                entry["statuses"].pop(seat_id, None)
            else:
                entry["statuses"][seat_id] = status
        entry["rev"] += 1
        return entry["rev"]


class SeatsHub:
    """Attaches the protocol to a `socketio.AsyncServer`."""

    def __init__(
        self,
        sio: socketio.AsyncServer,
        store: Optional[MemoryStore] = None,
        authorize: Optional[Authorize] = None,
    ):
        self.sio = sio
        self.store = store or MemoryStore()
        self._authorize = authorize or (lambda environ, auth, floorplan_id: True)
        sio.on("connect", self._on_connect)
        sio.on(SYNC_EVENT, self._on_sync)

    async def _on_connect(self, sid: str, environ: dict, auth: Optional[dict]):
        # One floorplan per connection, named in the handshake:
        #   io(url, { auth: { floorplanId, token } })
        floorplan_id = (auth or {}).get("floorplanId")
        if not isinstance(floorplan_id, str) or not floorplan_id:
            raise socketio.exceptions.ConnectionRefusedError("floorplanId is required")
        try:
            allowed = self._authorize(environ, auth or {}, floorplan_id)
            if inspect.isawaitable(allowed):
                allowed = await allowed
        except Exception:
            allowed = False
        if not allowed:
            raise socketio.exceptions.ConnectionRefusedError("Forbidden")
        await self.sio.save_session(sid, {"floorplan_id": floorplan_id})
        # Join before answering any sync, so no patch can fall between the two.
        await self.sio.enter_room(sid, room_for(floorplan_id))

    async def _on_sync(self, sid: str, request: Any):
        # The return value is sent back as the acknowledgement.
        version = request.get("v") if isinstance(request, dict) else None
        if version != PROTOCOL_VERSION:
            return {"v": PROTOCOL_VERSION, "error": f"Unsupported protocol version: {version}"}
        session = await self.sio.get_session(sid)
        try:
            rev, statuses = await self.store.get(session["floorplan_id"])
        except Exception:
            return {"v": PROTOCOL_VERSION, "error": "Could not load seat statuses"}
        return {"v": PROTOCOL_VERSION, "rev": rev, "statuses": statuses}

    async def publish(self, floorplan_id: str, changes: Changes) -> int:
        """Call after a booking, cancellation, hold, etc. has been committed."""
        rev = await self.store.apply(floorplan_id, changes)
        await self.sio.emit(
            PATCH_EVENT,
            {"v": PROTOCOL_VERSION, "rev": rev, "changes": changes},
            room=room_for(floorplan_id),
        )
        return rev
