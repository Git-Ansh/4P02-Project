"""
Analysis orchestration service.
Prepares submission ZIPs, runs comparison engine, stores results.
"""

import asyncio
import logging
import os
import shutil
import tempfile
import zipfile
from datetime import datetime, timezone

from bson import ObjectId

from src.config.settings import settings
from src.utils.encryption import decrypt_bytes

logger = logging.getLogger(__name__)


async def prepare_submission_zips(db, slug: str, course_id: ObjectId, assignment_id: ObjectId) -> str:
    """
    Gather all latest submissions for an assignment, zip each student's files,
    and return the path to a temp folder containing {student_number}.zip files.
    """
    pipeline = [
        {"$match": {"assignment_id": assignment_id, "course_id": course_id}},
        {"$sort": {"submitted_at": -1}},
        {"$group": {"_id": "$student_number", "doc": {"$first": "$$ROOT"}}},
        {"$replaceRoot": {"newRoot": "$doc"}},
    ]
    docs = await db.submissions.aggregate(pipeline).to_list(length=None)
    logger.warning("prepare_submission_zips: found %d submission docs in DB", len(docs))

    temp_dir = tempfile.mkdtemp(prefix="analysis_")
    upload_base = os.path.join(
        settings.UPLOAD_DIR, slug, str(course_id), str(assignment_id)
    )
    logger.warning("prepare_submission_zips: upload_base=%s  exists=%s", upload_base, os.path.isdir(upload_base))

    zips_created = 0
    for doc in docs:
        student_number = doc["student_number"]
        submission_id = doc.get("submission_id", student_number)

        # Try disk first: encrypted folder, then legacy folder
        student_dir = os.path.join(upload_base, submission_id)
        if not os.path.isdir(student_dir):
            student_dir = os.path.join(upload_base, student_number)

        if not os.path.isdir(student_dir):
            logger.warning("  student %s dir missing", student_number)
            continue

        zip_path = os.path.join(temp_dir, f"{student_number}.zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(student_dir):
                for fname in files:
                    full_path = os.path.join(root, fname)
                    arcname = os.path.relpath(full_path, student_dir)
                    try:
                        with open(full_path, "rb") as fh:
                            raw = decrypt_bytes(fh.read())
                        zf.writestr(arcname, raw)
                    except Exception:
                        zf.write(full_path, arcname)
        zips_created += 1

    logger.warning("prepare_submission_zips: created %d student ZIPs in %s", zips_created, temp_dir)
    return temp_dir


SOURCE_EXTS = {".java", ".cpp", ".c", ".cc", ".h", ".hpp"}


def _has_source_files(directory: str) -> bool:
    """Check if a directory tree contains any recognised source files."""
    for root, _, files in os.walk(directory):
        for f in files:
            if os.path.splitext(f)[1] in SOURCE_EXTS:
                return True
    return False


def _zip_folder(folder: str, dest_zip: str):
    """Zip a folder's contents into dest_zip."""
    with zipfile.ZipFile(dest_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(folder):
            for fname in files:
                full = os.path.join(root, fname)
                arcname = os.path.relpath(full, folder)
                zf.write(full, arcname)


def _process_ref_tree(extracted_dir: str, temp_dir: str, ref_label: str):
    """
    Intelligently process an extracted reference submission tree.
    Handles any structure:
      - Nested ZIPs (at any depth) → each inner ZIP becomes _ref_<name>.zip
      - Folders containing source code → each folder becomes _ref_<name>.zip
      - Source files at root → single _ref_<label>.zip
      - Mix of the above
    Inner ZIPs are recursively extracted to check for further nesting.
    """
    # Collect inner zips and top-level source-containing folders
    inner_zips = []
    source_dirs = []
    root_source_files = []

    # Skip __MACOSX and hidden dirs at every level
    for entry in os.listdir(extracted_dir):
        if entry.startswith(".") or entry == "__MACOSX":
            continue
        entry_path = os.path.join(extracted_dir, entry)
        if os.path.isdir(entry_path):
            # Scan folder for inner zips or source files
            folder_zips = []
            folder_has_source = False
            for root, _, files in os.walk(entry_path):
                for f in files:
                    full = os.path.join(root, f)
                    if f.endswith(".zip"):
                        folder_zips.append(full)
                    elif os.path.splitext(f)[1] in SOURCE_EXTS:
                        folder_has_source = True

            if folder_zips:
                inner_zips.extend(folder_zips)
            elif folder_has_source:
                source_dirs.append((entry, entry_path))
        elif entry.endswith(".zip"):
            inner_zips.append(entry_path)
        elif os.path.splitext(entry)[1] in SOURCE_EXTS:
            root_source_files.append(entry_path)

    ref_count = 0

    # Handle inner ZIPs — recursively extract nested ZIPs
    for iz in inner_zips:
        name = os.path.splitext(os.path.basename(iz))[0]
        # Check if the inner zip itself contains more zips (nested)
        nested_extract = tempfile.mkdtemp(prefix="ref_nested_")
        try:
            with zipfile.ZipFile(iz, "r") as zf:
                zf.extractall(nested_extract)
            # If the extracted content has further zips, recurse
            has_nested_zips = any(
                f.endswith(".zip")
                for _, _, files in os.walk(nested_extract)
                for f in files
            )
            if has_nested_zips:
                _process_ref_tree(nested_extract, temp_dir, ref_label=name)
            elif _has_source_files(nested_extract):
                # Contains source files — good, copy the original zip
                dest = os.path.join(temp_dir, f"_ref_{name}.zip")
                shutil.copy2(iz, dest)
                ref_count += 1
                logger.warning("  ref: added %s (from nested zip)", os.path.basename(dest))
            # else: zip had no source code, skip
        except zipfile.BadZipFile:
            logger.warning("  ref: skipping bad zip %s", os.path.basename(iz))
        finally:
            shutil.rmtree(nested_extract, ignore_errors=True)

    # Handle folders with source code directly
    for name, folder_path in source_dirs:
        dest = os.path.join(temp_dir, f"_ref_{name}.zip")
        _zip_folder(folder_path, dest)
        ref_count += 1
        logger.warning("  ref: added %s (from source folder)", os.path.basename(dest))

    # Handle source files at root (no subfolders) — treat as single reference
    if root_source_files and not inner_zips and not source_dirs:
        dest = os.path.join(temp_dir, f"_ref_{ref_label}.zip")
        _zip_folder(extracted_dir, dest)
        ref_count += 1
        logger.warning("  ref: added %s (from root source files)", os.path.basename(dest))

    logger.warning("  ref: total %d reference entries created", ref_count)


async def include_reference_submissions(db, temp_dir: str, slug: str,
                                         course_id: ObjectId, assignment_id: ObjectId):
    """
    Unpack reference submission ZIPs into the temp folder with _ref_ prefix.
    """
    refs = await db.reference_submissions.find({
        "assignment_id": assignment_id,
        "course_id": course_id,
    }).to_list(length=None)
    logger.warning("include_reference_submissions: found %d ref docs in DB", len(refs))

    for ref in refs:
        zip_path = ref.get("zip_path", "")
        # Translate stored path to local UPLOAD_DIR (handles VPS vs local mismatch)
        if not os.path.isfile(zip_path):
            default_prefix = "/opt/academic-fbi/uploads"
            if zip_path.startswith(default_prefix) and settings.UPLOAD_DIR != default_prefix:
                zip_path = settings.UPLOAD_DIR + zip_path[len(default_prefix):]
        logger.warning("  ref zip_path=%s  exists=%s", zip_path, os.path.isfile(zip_path))
        if not os.path.isfile(zip_path):
            continue

        ref_extract = tempfile.mkdtemp(prefix="ref_extract_")
        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(ref_extract)

            _process_ref_tree(ref_extract, temp_dir, ref_label=str(ref["_id"]))
        finally:
            shutil.rmtree(ref_extract, ignore_errors=True)


def get_template_folder(slug: str, course_id: str, assignment_id: str) -> str | None:
    """Return path to template folder if it exists."""
    path = os.path.join(
        settings.UPLOAD_DIR, slug, course_id, assignment_id, "_template"
    )
    if os.path.isdir(path) and os.listdir(path):
        return path
    return None


async def run_analysis_background(db, run_id: ObjectId, slug: str,
                                   course_id: ObjectId, assignment_id: ObjectId,
                                   similarity_threshold: float = 0.15):
    """
    Background task: prepare submissions, run engine, store results.
    """
    temp_dir = None
    try:
        temp_dir = await prepare_submission_zips(db, slug, course_id, assignment_id)
        await include_reference_submissions(db, temp_dir, slug, course_id, assignment_id)

        # Log what ended up in the temp dir
        temp_contents = os.listdir(temp_dir)
        logger.warning("run_analysis_background: temp_dir contains %d files: %s", len(temp_contents), temp_contents)

        # Check if we have any student submissions on disk
        student_zips = [f for f in temp_contents if f.endswith(".zip") and not f.startswith("_ref_")]
        ref_zips = [f for f in temp_contents if f.startswith("_ref_")]
        sub_count = await db.submissions.count_documents(
            {"assignment_id": assignment_id, "course_id": course_id}
        )
        ref_count = await db.reference_submissions.count_documents(
            {"assignment_id": assignment_id, "course_id": course_id}
        )

        if ref_count > 0 and not ref_zips:
            logger.warning(
                "run_analysis_background: %d reference(s) in DB but 0 loaded — "
                "reference ZIP files may be missing from disk", ref_count
            )

        if not student_zips and sub_count > 0:
            raise RuntimeError(
                f"No student submission files found on disk ({sub_count} submission(s) "
                f"in database). Students may need to re-upload their work."
            )

        if not student_zips and not ref_zips:
            raise RuntimeError(
                "No submissions or reference files available to analyze."
            )

        template_folder = get_template_folder(slug, str(course_id), str(assignment_id))
        logger.warning("run_analysis_background: template_folder=%s", template_folder)

        # Lazy import — tree-sitter may not be installed
        from functools import partial
        from src.services.comparison_engine import run_engine

        # Run engine in executor (CPU-bound)
        loop = asyncio.get_event_loop()
        report = await loop.run_in_executor(
            None,
            partial(run_engine, temp_dir, template_folder,
                    similarity_threshold=similarity_threshold),
        )

        await db.analysis_runs.update_one(
            {"_id": run_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc),
                "report": report,
            }},
        )
    except Exception as e:
        await db.analysis_runs.update_one(
            {"_id": run_id},
            {"$set": {
                "status": "failed",
                "completed_at": datetime.now(timezone.utc),
                "error": str(e),
            }},
        )
    finally:
        if temp_dir and os.path.isdir(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
