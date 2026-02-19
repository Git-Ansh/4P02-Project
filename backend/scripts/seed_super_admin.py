"""
Seed the initial super admin into MongoDB Atlas.

Usage:
    cd backend && python -m scripts.seed_super_admin
"""

import asyncio
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.server_api import ServerApi

from src.config.settings import settings
from src.services.auth import hash_password

SUPER_ADMIN_EMAIL = "superadmin@academicfbi.com"
SUPER_ADMIN_PASSWORD = "SuperAdmin123!"
SUPER_ADMIN_NAME = "Super Admin"


async def seed():
    client = AsyncIOMotorClient(settings.MONGODB_URI, server_api=ServerApi("1"))
    db = client[settings.DB_NAME]

    # Ensure unique index on email
    await db.super_admins.create_index("email", unique=True)

    existing = await db.super_admins.find_one({"email": SUPER_ADMIN_EMAIL})
    if existing:
        print(f"Super admin '{SUPER_ADMIN_EMAIL}' already exists — skipping.")
        client.close()
        return

    doc = {
        "email": SUPER_ADMIN_EMAIL,
        "password_hash": hash_password(SUPER_ADMIN_PASSWORD),
        "full_name": SUPER_ADMIN_NAME,
        "role": "super_admin",
        "created_at": datetime.now(timezone.utc),
    }
    await db.super_admins.insert_one(doc)
    print(f"Super admin '{SUPER_ADMIN_EMAIL}' created successfully.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
