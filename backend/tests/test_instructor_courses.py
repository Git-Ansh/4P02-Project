"""Tests for instructor course CRUD."""

from datetime import datetime, timezone

from bson import ObjectId

from tests.helpers import TEST_UNI_SLUG, auth_header

# A future end_date used across course creation tests
_END_DATE = "2026-12-15T12:00:00Z"


class TestCourseCreate:
    async def test_create_course(self, client, instructor_token, seed_instructor):
        resp = await client.post(
            "/api/instructor/courses",
            headers=auth_header(instructor_token),
            json={"code": "CS200", "title": "Data Structures", "end_date": _END_DATE},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["code"] == "CS200"
        assert data["instructor_email"] == "instructor@test.com"
        # term is auto-computed — just verify it is present and non-empty
        assert data["term"]

    async def test_create_duplicate_course(
        self, client, instructor_token, sample_course
    ):
        # sample_course is CS101 — creating it again via the API should conflict.
        # We must include end_date so the term auto-computes to the same value
        # stored in sample_course ("Winter 2026"), triggering the 409.
        resp = await client.post(
            "/api/instructor/courses",
            headers=auth_header(instructor_token),
            json={"code": "CS101", "title": "Whatever", "end_date": "2026-04-30T12:00:00Z"},
        )
        assert resp.status_code == 409

    async def test_create_course_missing_end_date(
        self, client, instructor_token, seed_instructor
    ):
        resp = await client.post(
            "/api/instructor/courses",
            headers=auth_header(instructor_token),
            json={"code": "CS300", "title": "No End Date"},
        )
        assert resp.status_code == 422


class TestCourseList:
    async def test_list_courses(self, client, instructor_token, sample_course):
        resp = await client.get(
            "/api/instructor/courses", headers=auth_header(instructor_token)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["code"] == "CS101"

    async def test_only_own_courses(
        self, client, instructor_token, seed_instructor, mongo_client
    ):
        db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
        await db.courses.insert_one(
            {
                "code": "OTHER100",
                "title": "Other Course",
                "term": "Fall 2026",
                "instructor_email": "other@test.com",
                "instructor_name": "Other",
                "created_at": datetime.now(timezone.utc),
            }
        )
        resp = await client.get(
            "/api/instructor/courses", headers=auth_header(instructor_token)
        )
        codes = [c["code"] for c in resp.json()]
        assert "OTHER100" not in codes


class TestCourseGetUpdateDelete:
    async def test_get_course(self, client, instructor_token, sample_course):
        cid = str(sample_course["_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}", headers=auth_header(instructor_token)
        )
        assert resp.status_code == 200
        assert resp.json()["code"] == "CS101"

    async def test_get_nonexistent(self, client, instructor_token, seed_instructor):
        resp = await client.get(
            f"/api/instructor/courses/{ObjectId()}",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 404

    async def test_update_course(self, client, instructor_token, sample_course):
        cid = str(sample_course["_id"])
        resp = await client.patch(
            f"/api/instructor/courses/{cid}",
            headers=auth_header(instructor_token),
            json={"title": "Updated Title"},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"

    async def test_update_no_fields(self, client, instructor_token, sample_course):
        cid = str(sample_course["_id"])
        resp = await client.patch(
            f"/api/instructor/courses/{cid}",
            headers=auth_header(instructor_token),
            json={},
        )
        assert resp.status_code == 400

    async def test_delete_course(self, client, instructor_token, sample_course):
        cid = str(sample_course["_id"])
        resp = await client.delete(
            f"/api/instructor/courses/{cid}", headers=auth_header(instructor_token)
        )
        assert resp.status_code == 204

    async def test_delete_nonexistent(self, client, instructor_token, seed_instructor):
        resp = await client.delete(
            f"/api/instructor/courses/{ObjectId()}",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 404

    async def test_requires_auth(self, client):
        resp = await client.get("/api/instructor/courses")
        assert resp.status_code in (401, 403)
