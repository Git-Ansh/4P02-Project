"""Tests for instructor assignment CRUD."""

from bson import ObjectId

from tests.helpers import auth_header


class TestAssignmentCreate:
    async def test_create_assignment(self, client, instructor_token, sample_course):
        cid = str(sample_course["_id"])
        resp = await client.post(
            f"/api/instructor/courses/{cid}/assignments",
            headers=auth_header(instructor_token),
            json={
                "title": "New Assignment",
                "description": "Test desc",
                "language": "java",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "New Assignment"
        assert data["language"] == "java"

    async def test_nonexistent_course(self, client, instructor_token, seed_instructor):
        resp = await client.post(
            f"/api/instructor/courses/{ObjectId()}/assignments",
            headers=auth_header(instructor_token),
            json={"title": "X", "language": "java"},
        )
        assert resp.status_code == 404


class TestAssignmentListUpdateDelete:
    async def test_list_assignments(self, client, instructor_token, sample_assignment):
        cid = str(sample_assignment["course_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}/assignments",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_update_assignment(self, client, instructor_token, sample_assignment):
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.patch(
            f"/api/instructor/courses/{cid}/assignments/{aid}",
            headers=auth_header(instructor_token),
            json={"title": "Updated Assignment"},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Assignment"

    async def test_update_nonexistent(self, client, instructor_token, sample_course):
        cid = str(sample_course["_id"])
        resp = await client.patch(
            f"/api/instructor/courses/{cid}/assignments/{ObjectId()}",
            headers=auth_header(instructor_token),
            json={"title": "X"},
        )
        assert resp.status_code == 404

    async def test_update_no_fields(self, client, instructor_token, sample_assignment):
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.patch(
            f"/api/instructor/courses/{cid}/assignments/{aid}",
            headers=auth_header(instructor_token),
            json={},
        )
        assert resp.status_code == 400

    async def test_delete_assignment(self, client, instructor_token, sample_assignment):
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.delete(
            f"/api/instructor/courses/{cid}/assignments/{aid}",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 204

    async def test_delete_nonexistent(self, client, instructor_token, sample_course):
        cid = str(sample_course["_id"])
        resp = await client.delete(
            f"/api/instructor/courses/{cid}/assignments/{ObjectId()}",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 404
