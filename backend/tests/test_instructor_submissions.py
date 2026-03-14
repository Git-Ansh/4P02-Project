"""Tests for instructor submission listing and download."""

from datetime import datetime, timezone

from tests.helpers import TEST_UNI_SLUG, auth_header


class TestSubmissions:
    async def test_list_submissions(
        self, client, instructor_token, sample_assignment, mongo_client
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
                "comment": None,
                "files": [{"name": "Main.java", "size": 100}],
                "submitted_at": datetime.now(timezone.utc),
            }
        )
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}/assignments/{aid}/submissions",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        # Submissions must be anonymous
        for sub in data:
            assert "student_number" not in sub
            assert "student_name" not in sub
            assert "student_email" not in sub

    async def test_list_submissions_empty(
        self, client, instructor_token, sample_assignment
    ):
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}/assignments/{aid}/submissions",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_download_no_submissions(
        self, client, instructor_token, sample_assignment
    ):
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}/assignments/{aid}/submissions/download",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 404

    async def test_latest_per_student(
        self, client, instructor_token, sample_assignment, mongo_client
    ):
        """Only the most recent submission per student is returned."""
        db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
        base = {
            "assignment_id": sample_assignment["_id"],
            "course_id": sample_assignment["course_id"],
            "student_name": "Jane",
            "student_email": "jane@test.edu",
            "student_number": "STU001",
            "language": "java",
            "files": [{"name": "X.java", "size": 1}],
        }
        await db.submissions.insert_one(
            {**base, "submitted_at": datetime(2026, 1, 1, tzinfo=timezone.utc)}
        )
        await db.submissions.insert_one(
            {**base, "submitted_at": datetime(2026, 2, 1, tzinfo=timezone.utc)}
        )
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}/assignments/{aid}/submissions",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1
