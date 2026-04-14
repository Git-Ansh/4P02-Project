"""
Set (or update) the end_date on an existing course in MongoDB.

This is the only sanctioned way to change a course's end_date after creation,
since the instructor API deliberately locks that field.

Usage
-----
    cd backend
    python -m scripts.set_course_end_date --slug <university-slug> \
                                           --code <course-code> \
                                           --end-date YYYY-MM-DD

Example
-------
    python -m scripts.set_course_end_date --slug brock-university \
                                           --code "COSC 4P02" \
                                           --end-date 2026-04-30

The end date is interpreted as midnight Toronto time (America/Toronto).
"""

import argparse
import asyncio
import sys
from datetime import datetime, timezone

from zoneinfo import ZoneInfo
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.server_api import ServerApi

from src.config.settings import settings

TORONTO_TZ = ZoneInfo("America/Toronto")


def _parse_args():
    p = argparse.ArgumentParser(description="Set a course end_date in MongoDB")
    p.add_argument("--slug", required=True, help="University slug (e.g. brock-university)")
    p.add_argument("--code", required=True, help="Course code (e.g. 'COSC 4P02')")
    p.add_argument("--end-date", required=True, dest="end_date",
                   help="End date in YYYY-MM-DD (midnight Toronto time)")
    return p.parse_args()


async def main():
    args = _parse_args()

    # Parse date as midnight Toronto time → store as UTC in MongoDB
    local_midnight = datetime.strptime(args.end_date, "%Y-%m-%d").replace(
        tzinfo=TORONTO_TZ
    )
    end_date_utc = local_midnight.astimezone(timezone.utc)

    client = AsyncIOMotorClient(settings.mongodb_uri, server_api=ServerApi("1"))
    db = client[f"uni_{args.slug}"]

    result = await db.courses.update_one(
        {"code": args.code},
        {"$set": {"end_date": end_date_utc}},
    )

    client.close()

    if result.matched_count == 0:
        print(f"ERROR: No course found with code '{args.code}' in uni_{args.slug}")
        sys.exit(1)

    print(
        f"Updated '{args.code}' end_date → "
        f"{local_midnight.strftime('%B %d, %Y')} Toronto "
        f"({end_date_utc.strftime('%Y-%m-%dT%H:%M:%SZ')} UTC)"
    )


if __name__ == "__main__":
    asyncio.run(main())
