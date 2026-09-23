from fastapi import APIRouter, HTTPException

from app.catalog.sketches import SKETCHES, SKETCHES_BY_ID
from app.models.sketch import Sketch

router = APIRouter(prefix="/sketches", tags=["Catalog"])


@router.get("", response_model=list[Sketch])
async def list_sketches(category: str | None = None) -> list[Sketch]:
    return [s for s in SKETCHES if category is None or s.category == category]


@router.get("/{sketch_id}", response_model=Sketch)
async def get_sketch(sketch_id: str) -> Sketch:
    sketch = SKETCHES_BY_ID.get(sketch_id)
    if sketch is None:
        raise HTTPException(404, detail={"code": "not_found", "message": "No such sketch"})
    return sketch
