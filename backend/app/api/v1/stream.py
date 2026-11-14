import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.events import broadcaster

router = APIRouter(prefix="/stream", tags=["stream"])


@router.get("/{machine_id}")
async def stream_machine_telemetry(machine_id: str):
    """
    Server-Sent Events (SSE) streaming live sensor readings and alerts for a machine.
    """
    queue = await broadcaster.subscribe(machine_id)

    async def event_generator():
        try:
            # Yield initial connection message
            yield "event: ping\ndata: {\"status\": \"connected\"}\n\n"
            while True:
                try:
                    # Wait for next event with 15s timeout for keep-alive heartbeat
                    payload = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"event: message\ndata: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield "event: heartbeat\ndata: {\"status\": \"alive\"}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await broadcaster.unsubscribe(machine_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
