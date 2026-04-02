from fastapi import APIRouter, HTTPException, status

from src.config.database import get_main_db, get_university_db
from src.models.schemas import LoginRequest, TokenResponse, UniversityResponse, UniversityTheme
from src.services.auth import create_access_token, verify_password

router = APIRouter(prefix="/api", tags=["Auth"])


@router.get("/universities", response_model=list[UniversityResponse])
async def list_active_universities():
    db = get_main_db()
    docs = await db.universities.find({"status": "active"}).sort("name", 1).to_list(length=None)
    return [
        UniversityResponse(
            id=str(d["_id"]),
            name=d["name"],
            slug=d["slug"],
            domain=d.get("domain"),
            logo_url=d.get("logo_url"),
            primary_color=d.get("primary_color"),
            secondary_color=d.get("secondary_color"),
            status=d["status"],
            created_at=d["created_at"],
        )
        for d in docs
    ]


@router.get("/universities/{slug}/theme", response_model=UniversityTheme)
async def get_university_theme(slug: str):
    from fastapi import HTTPException as _H
    db = get_main_db()
    uni = await db.universities.find_one({"slug": slug, "status": "active"})
    if not uni:
        raise _H(status_code=404, detail="University not found")
    return UniversityTheme(
        name=uni["name"],
        slug=uni["slug"],
        logo_url=uni.get("logo_url"),
        primary_color=uni.get("primary_color"),
        secondary_color=uni.get("secondary_color"),
    )


@router.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    if body.university_slug is None:
        # Super admin login
        db = get_main_db()
        user = await db.super_admins.find_one({"email": body.email})
        if not user or not verify_password(body.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        token = create_access_token(
            {"sub": user["email"], "role": "super_admin", "university_slug": None}
        )
        return TokenResponse(
            access_token=token, role="super_admin", university_slug=None
        )

    # University user login
    db = get_main_db()
    university = await db.universities.find_one(
        {"slug": body.university_slug, "status": "active"}
    )
    if not university:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    uni_db = get_university_db(body.university_slug)
    user = await uni_db.users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(
        {
            "sub": user["email"],
            "role": user["role"],
            "university_slug": body.university_slug,
            "full_name": user.get("full_name", ""),
        }
    )
    return TokenResponse(
        access_token=token,
        role=user["role"],
        university_slug=body.university_slug,
    )
