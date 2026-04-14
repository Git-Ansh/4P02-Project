"""
Course expiry service — background cleanup task.

Policy
------
Every course has a mandatory ``end_date`` set at creation time.  Once that
date passes, instructors enter a **30-day grace period** during which they
can still view and download submissions.  After the grace period expires the
submissions and associated files are permanently deleted to reclaim disk space.

Status lifecycle
----------------
active          end_date is in the future (or > 14 days away)
expiring_soon   end_date is in the future, ≤ 14 days away
grace_period    end_date passed, ≤ 30 days ago
data_deleted    end_date + 30 days has passed — data purged

Background task
---------------
``start_expiry_cleanup_task()`` registers an asyncio task that runs the
cleanup loop once a day.  The task is fire-and-forget; errors are logged
and the loop continues.

The task:
1. Iterates over every university database.
2. Finds courses whose ``end_date + 30 days`` has passed and whose data
   has not yet been deleted (``data_deleted`` flag not set).
3. Deletes all submission files from disk.
4. Removes submission and analysis documents from MongoDB.
5. Stamps the course document with ``data_deleted: True`` so the sweep
   does not touch the course again.
"""

import asyncio
import logging
import os
import shutil
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from src.config.database import get_main_db, get_university_db
from src.config.settings import settings

TORONTO_TZ = ZoneInfo("America/Toronto")

logger = logging.getLogger(__name__)

GRACE_PERIOD_DAYS = 30
CLEANUP_INTERVAL_SECONDS = 24 * 60 * 60  # run once per day


async def _cleanup_expired_courses() -> None:
    """Delete submission data for courses whose grace period has ended.

    Iterates every university slug found in the main database, then scans
    that university's course collection for courses that are past the grace
    period.  For each such course every submission document and its on-disk
    encrypted files are removed, and the course is stamped as data_deleted.
    """
    main_db = get_main_db()
    unis = await main_db.universities.find(
        {}, {"slug": 1}
    ).to_list(length=None)

    # Cutoff = end of day, 30 days ago, Toronto time → convert to UTC for the query
    now_toronto = datetime.now(TORONTO_TZ)
    cutoff_toronto = now_toronto - timedelta(days=GRACE_PERIOD_DAYS)
    cutoff = cutoff_toronto.astimezone(timezone.utc)

    for uni in unis:
        slug = uni.get("slug")
        if not slug:
            continue
        db = get_university_db(slug)

        # Courses whose end_date is before the cutoff and data not yet deleted
        expired_courses = await db.courses.find(
            {
                "end_date": {"$lt": cutoff},
                "data_deleted": {"$ne": True},
            }
        ).to_list(length=None)

        for course in expired_courses:
            course_id = course["_id"]
            course_code = course.get("code", str(course_id))

            try:
                # Collect all assignments for this course
                assignments = await db.assignments.find(
                    {"course_id": course_id}, {"_id": 1}
                ).to_list(length=None)
                assignment_ids = [a["_id"] for a in assignments]

                # Delete on-disk submission files
                for aid in assignment_ids:
                    submission_dir = os.path.join(
                        settings.upload_dir,
                        slug,
                        str(course_id),
                        str(aid),
                    )
                    if os.path.isdir(submission_dir):
                        shutil.rmtree(submission_dir, ignore_errors=True)
                        logger.info(
                            "Deleted submission files: %s", submission_dir
                        )

                # Remove all submissions for this course from MongoDB
                if assignment_ids:
                    del_result = await db.submissions.delete_many(
                        {"assignment_id": {"$in": assignment_ids}}
                    )
                    logger.info(
                        "Course %s (%s): deleted %d submission documents",
                        course_code,
                        slug,
                        del_result.deleted_count,
                    )

                    # Remove analysis runs and reports
                    await db.analysis_runs.delete_many(
                        {"assignment_id": {"$in": assignment_ids}}
                    )

                # Stamp the course so we don't process it again
                await db.courses.update_one(
                    {"_id": course_id},
                    {"$set": {"data_deleted": True, "data_deleted_at": datetime.now(timezone.utc)}},
                )
                logger.info(
                    "Course %s (%s): marked as data_deleted", course_code, slug
                )

            except Exception:
                logger.exception(
                    "Error cleaning up course %s (%s)", course_code, slug
                )


async def _expiry_cleanup_loop() -> None:
    """Run the cleanup sweep once a day, forever.

    Errors inside a single sweep are caught and logged; the loop always
    schedules the next run so a transient failure does not stop future
    cleanups.
    """
    while True:
        try:
            await _cleanup_expired_courses()
        except Exception:
            logger.exception("Unexpected error in expiry cleanup loop")
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)


def start_expiry_cleanup_task() -> asyncio.Task:
    """Schedule the background expiry cleanup loop.

    Call this once from the FastAPI lifespan startup hook.  Returns the
    asyncio Task so the caller can cancel it on shutdown.
    """
    task = asyncio.create_task(_expiry_cleanup_loop())
    logger.info("Course expiry cleanup task started (interval: %ds)", CLEANUP_INTERVAL_SECONDS)
    return task
