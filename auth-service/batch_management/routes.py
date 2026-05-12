import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth.dependencies import get_current_user, require_manager_or_above
from config import settings

router = APIRouter(prefix="/batch-management", tags=["batch-management"])


class BatchRequest(BaseModel):
    batchName: str
    traineeCount: int
    subjects: list[str]


def _sb_url(path: str = "") -> str:
    return f"{settings.SPRINGBOOT_BASE_URL}/api/subjects{path}"


async def _proxy(method: str, url: str, **kwargs):
    try:
        async with httpx.AsyncClient() as client:
            r = await client.request(method, url, **kwargs)
        if r.status_code == 404:
            raise HTTPException(status_code=404, detail="Batch not found")
        r.raise_for_status()
        return r
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Spring Boot service unavailable")


@router.get("", dependencies=[Depends(get_current_user)])
async def list_batches():
    r = await _proxy("GET", _sb_url())
    return r.json()


@router.post("", status_code=201, dependencies=[Depends(require_manager_or_above)])
async def create_batch(body: BatchRequest):
    r = await _proxy("POST", _sb_url(), json=body.model_dump())
    return r.json()


@router.get("/{batch_name}", dependencies=[Depends(get_current_user)])
async def get_batch(batch_name: str):
    r = await _proxy("GET", _sb_url(f"/{batch_name}"))
    return r.json()


@router.put("/{batch_name}", dependencies=[Depends(require_manager_or_above)])
async def update_batch(batch_name: str, body: BatchRequest):
    r = await _proxy("PUT", _sb_url(f"/{batch_name}"), json=body.model_dump())
    return r.json()


@router.delete("/{batch_name}", status_code=204, dependencies=[Depends(require_manager_or_above)])
async def delete_batch(batch_name: str):
    await _proxy("DELETE", _sb_url(f"/{batch_name}"))
