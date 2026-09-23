from fastapi import APIRouter, HTTPException

from app.catalog.materials import MATERIALS, MATERIALS_BY_ID
from app.catalog.palettes import PALETTES
from app.models.material import Material, PaletteDirection

router = APIRouter(prefix="/materials", tags=["Catalog"])


@router.get("", response_model=list[Material])
async def list_materials() -> tuple[Material, ...]:
    return MATERIALS


@router.get("/palettes", response_model=list[PaletteDirection])
async def list_palettes() -> tuple[PaletteDirection, ...]:
    """Board-level palette directions Jev chooses between."""
    return PALETTES


@router.get("/{material_id}", response_model=Material)
async def get_material(material_id: str) -> Material:
    material = MATERIALS_BY_ID.get(material_id)
    if material is None:
        raise HTTPException(404, detail={"code": "not_found", "message": "No such material"})
    return material
