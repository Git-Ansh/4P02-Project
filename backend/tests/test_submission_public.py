"""Tests for the public submission endpoint."""

import io
import os
import zipfile
from datetime import datetime, timedelta, timezone

from jose import jwt

from src.config.settings import settings
from tests.helpers import TEST_UNI_SLUG


def _make_submission_token(assignment_id: str, course_id: str, expired=False) -> str:
    exp = datetime.now(timezone.utc) + (
        timedelta(days=-1) if expired else timedelta(days=30)
    )
    payload = {
        "type": "submission",
        "university_slug": TEST_UNI_SLUG,
        "university_name": "Test University",
        "instructor_name": "Test Instructor",
        "course_id": course_id,
        "course_code": "CS101",
        "course_title": "Intro to CS",
        "assignment_id": assignment_id,
        "assignment_title": "Assignment 1",
        "language": "java",
        "exp": exp,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


class TestGetAssignment:
    async def test_valid_token(self, client, seed_university, sample_assignment):
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)
        resp = await client.get(f"/api/public/assignment?token={token}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["assignment_title"] == "Assignment 1"
        assert data["university_slug"] == TEST_UNI_SLUG

    async def test_expired_token(self, client, seed_university, sample_assignment):
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid, expired=True)
        resp = await client.get(f"/api/public/assignment?token={token}")
        assert resp.status_code == 401

    async def test_invalid_token(self, client):
        resp = await client.get("/api/public/assignment?token=garbage")
        assert resp.status_code == 401

    async def test_wrong_token_type(self, client, seed_university, sample_assignment):
        """Token with type != 'submission' should be rejected."""
        aid = str(sample_assignment["_id"])
        payload = {
            "type": "access",
            "university_slug": TEST_UNI_SLUG,
            "assignment_id": aid,
            "exp": datetime.now(timezone.utc) + timedelta(days=1),
        }
        token = jwt.encode(
            payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
        )
        resp = await client.get(f"/api/public/assignment?token={token}")
        assert resp.status_code == 401


class TestSubmitAssignment:
    async def test_submit_valid(
        self, client, seed_university, sample_assignment, sample_student
    ):
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)

        # Ensure upload dir exists
        upload_dir = os.path.join(
            settings.UPLOAD_DIR, TEST_UNI_SLUG, cid, aid, "STU001"
        )
        os.makedirs(os.path.dirname(upload_dir), exist_ok=True)

        resp = await client.post(
            "/api/public/submit",
            data={
                "token": token,
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
            },
            files=[("files", ("Main.java", b"public class Main {}", "text/plain"))],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["student_number"] == "STU001"
        assert len(data["files"]) == 1

    async def test_wrong_file_type(
        self, client, seed_university, sample_assignment, sample_student
    ):
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)
        resp = await client.post(
            "/api/public/submit",
            data={
                "token": token,
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
            },
            files=[("files", ("script.py", b"print('hi')", "text/plain"))],
        )
        assert resp.status_code == 400

    async def test_resubmission_blocked(
        self, client, seed_university, sample_assignment, sample_student, mongo_client
    ):
        db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
        await db.submissions.insert_one(
            {
                "assignment_id": sample_assignment["_id"],
                "course_id": sample_assignment["course_id"],
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
                "language": "java",
                "files": [{"name": "Main.java", "size": 10}],
                "submitted_at": datetime.now(timezone.utc),
            }
        )
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)
        resp = await client.post(
            "/api/public/submit",
            data={
                "token": token,
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
            },
            files=[("files", ("Main.java", b"class X{}", "text/plain"))],
        )
        assert resp.status_code == 409


class TestSubmitZipFiles:
    async def test_submit_zip_valid(
        self, client, seed_university, sample_assignment, sample_student
    ):
        """Submit a .zip containing valid Java files."""
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("Main.java", "public class Main { void run() {} }")
            zf.writestr("Helper.java", "public class Helper {}")
        buf.seek(0)

        resp = await client.post(
            "/api/public/submit",
            data={
                "token": token,
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
            },
            files=[("files", ("submission.zip", buf.getvalue(), "application/zip"))],
        )
        assert resp.status_code == 200
        data = resp.json()
        filenames = [f["name"] for f in data["files"]]
        assert any("Main.java" in n for n in filenames)
        assert any("Helper.java" in n for n in filenames)

    async def test_submit_zip_nested(
        self, client, seed_university, sample_assignment, sample_student
    ):
        """Submit a ZIP containing another ZIP — should be recursively extracted."""
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)

        inner_buf = io.BytesIO()
        with zipfile.ZipFile(inner_buf, "w") as inner:
            inner.writestr("Nested.java", "public class Nested {}")
        inner_buf.seek(0)

        outer_buf = io.BytesIO()
        with zipfile.ZipFile(outer_buf, "w") as outer:
            outer.writestr("inner.zip", inner_buf.getvalue())
            outer.writestr("Top.java", "public class Top {}")
        outer_buf.seek(0)

        resp = await client.post(
            "/api/public/submit",
            data={
                "token": token,
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
            },
            files=[("files", ("submission.zip", outer_buf.getvalue(), "application/zip"))],
        )
        assert resp.status_code == 200
        filenames = [f["name"] for f in resp.json()["files"]]
        assert any("Nested.java" in n for n in filenames)
        assert any("Top.java" in n for n in filenames)

    async def test_submit_zip_invalid_contents(
        self, client, seed_university, sample_assignment, sample_student
    ):
        """ZIP containing .py for a java assignment → 400."""
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("script.py", "print('hello')")
        buf.seek(0)

        resp = await client.post(
            "/api/public/submit",
            data={
                "token": token,
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
            },
            files=[("files", ("code.zip", buf.getvalue(), "application/zip"))],
        )
        assert resp.status_code == 400

    async def test_submit_zip_with_folders(
        self, client, seed_university, sample_assignment, sample_student
    ):
        """ZIP with subdirectory structure → files extracted preserving dirs."""
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("src/main/Main.java", "public class Main {}")
        buf.seek(0)

        resp = await client.post(
            "/api/public/submit",
            data={
                "token": token,
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
            },
            files=[("files", ("project.zip", buf.getvalue(), "application/zip"))],
        )
        assert resp.status_code == 200
        filenames = [f["name"] for f in resp.json()["files"]]
        assert any("Main.java" in n for n in filenames)

    async def test_submit_mixed_zip_and_source(
        self, client, seed_university, sample_assignment, sample_student
    ):
        """Mix of .zip + raw .java in the same request."""
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("FromZip.java", "public class FromZip {}")
        buf.seek(0)

        resp = await client.post(
            "/api/public/submit",
            data={
                "token": token,
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
            },
            files=[
                ("files", ("Raw.java", b"public class Raw {}", "text/plain")),
                ("files", ("extra.zip", buf.getvalue(), "application/zip")),
            ],
        )
        assert resp.status_code == 200
        filenames = [f["name"] for f in resp.json()["files"]]
        assert any("Raw.java" in n for n in filenames)
        assert any("FromZip.java" in n for n in filenames)

    async def test_submit_empty_zip(
        self, client, seed_university, sample_assignment, sample_student
    ):
        """Empty ZIP → 400 (no source files found)."""
        aid = str(sample_assignment["_id"])
        cid = str(sample_assignment["course_id"])
        token = _make_submission_token(aid, cid)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w"):
            pass  # empty
        buf.seek(0)

        resp = await client.post(
            "/api/public/submit",
            data={
                "token": token,
                "student_name": "Jane Student",
                "student_email": "jane@test.edu",
                "student_number": "STU001",
            },
            files=[("files", ("empty.zip", buf.getvalue(), "application/zip"))],
        )
        assert resp.status_code == 400
