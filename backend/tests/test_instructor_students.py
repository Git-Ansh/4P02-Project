"""Tests for instructor student enrollment/removal."""

from datetime import datetime, timezone

from bson import ObjectId

from tests.helpers import TEST_UNI_SLUG, auth_header


class TestStudentEnrollment:
    async def test_list_enrolled(self, client, instructor_token, sample_course, sample_student):
        cid = str(sample_course["_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}/students",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_list_available(
        self, client, instructor_token, sample_course, mongo_client
    ):
        db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
        await db.student_records.insert_one(
            {
                "full_name": "Available Student",
                "email": "available@test.edu",
                "student_number": "AVL001",
                "course_ids": [],
                "created_at": datetime.now(timezone.utc),
            }
        )
        cid = str(sample_course["_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}/available-students",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 200
        numbers = [s["student_number"] for s in resp.json()]
        assert "AVL001" in numbers

    async def test_enroll_students(
        self, client, instructor_token, sample_course, mongo_client
    ):
        db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
        result = await db.student_records.insert_one(
            {
                "full_name": "To Enroll",
                "email": "enroll@test.edu",
                "student_number": "ENR001",
                "course_ids": [],
                "created_at": datetime.now(timezone.utc),
            }
        )
        sid = str(result.inserted_id)
        cid = str(sample_course["_id"])
        resp = await client.post(
            f"/api/instructor/courses/{cid}/students",
            headers=auth_header(instructor_token),
            json={"student_ids": [sid]},
        )
        assert resp.status_code == 200
        numbers = [s["student_number"] for s in resp.json()]
        assert "ENR001" in numbers

    async def test_enroll_already_enrolled_is_idempotent(
        self, client, instructor_token, sample_course, sample_student
    ):
        cid = str(sample_course["_id"])
        sid = str(sample_student["_id"])
        resp = await client.post(
            f"/api/instructor/courses/{cid}/students",
            headers=auth_header(instructor_token),
            json={"student_ids": [sid]},
        )
        assert resp.status_code == 200

    async def test_remove_student(
        self, client, instructor_token, sample_course, sample_student
    ):
        cid = str(sample_course["_id"])
        sid = str(sample_student["_id"])
        resp = await client.delete(
            f"/api/instructor/courses/{cid}/students/{sid}",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 204

    async def test_remove_nonexistent(self, client, instructor_token, sample_course):
        cid = str(sample_course["_id"])
        resp = await client.delete(
            f"/api/instructor/courses/{cid}/students/{ObjectId()}",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 404
