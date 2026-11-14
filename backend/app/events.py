import asyncio
import json
from typing import Dict, Set, Any
from app.core.logging import logger


class EventBroadcaster:
    def __init__(self):
        # Map machine_id -> set of asyncio.Queue
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, machine_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            if machine_id not in self._subscribers:
                self._subscribers[machine_id] = set()
            self._subscribers[machine_id].add(queue)
        logger.info(f"New SSE subscriber for machine {machine_id} (total: {len(self._subscribers[machine_id])})")
        return queue

    async def unsubscribe(self, machine_id: str, queue: asyncio.Queue):
        async with self._lock:
            if machine_id in self._subscribers:
                self._subscribers[machine_id].discard(queue)
                if not self._subscribers[machine_id]:
                    del self._subscribers[machine_id]
        logger.info(f"Unsubscribed SSE client for machine {machine_id}")

    async def broadcast(self, machine_id: str, event_type: str, data: Any):
        payload = json.dumps({"type": event_type, "data": data}, default=str)
        async with self._lock:
            queues = list(self._subscribers.get(machine_id, []))
        
        for q in queues:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                # Drop oldest event if client is lagging
                try:
                    _ = q.get_nowait()
                    q.put_nowait(payload)
                except Exception:
                    pass


broadcaster = EventBroadcaster()
