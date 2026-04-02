"""Tests for university admin endpoints."""

from bson import ObjectId

from tests.helpers import auth_header


class TestAdminDashboard:
    async def test_dashboard(self, client, admin_token, seed_admin_user):
        resp = await client.get(
            "/api/admin/dashboard", headers=auth_header(admin_token)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "instructor_count" in data
        assert "course_count" in data
        assert "student_record_count" in data

    async def test_forbidden_for_instructor(self, client, instructor_token):
        resp = await client.get(
            "/api/admin/dashboard", headers=auth_header(instructor_token)
        )
        assert resp.status_code == 403


class TestInstructorManagement:
    async def test_create_instructor(self, client, admin_token, seed_admin_user):
        resp = await client.post(
            "/api/admin/instructors",
            headers=auth_header(admin_token),
            json={
                "email": "newinstructor@test.com",
                "password": "password123",
                "full_name": "New Instructor",
                "role": "instructor",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["role"] == "instructor"

    async def test_create_duplicate(self, client, admin_token, seed_admin_user, seed_instructor):
        resp = await client.post(
            "/api/admin/instructors",
            headers=auth_header(admin_token),
            json={
                "email": "instructor@test.com",
                "password": "password123",
                "full_name": "Dup",
                "role": "instructor",
            },
        )
        assert resp.status_code == 409

    async def test_list_instructors(
        self, client, admin_token, seed_admin_user, seed_instructor
    ):
        resp = await client.get(
            "/api/admin/instructors", headers=auth_header(admin_token)
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_delete_instructor(
        self, client, admin_token, seed_admin_user, seed_instructor
    ):
        iid = str(seed_instructor["_id"])
        resp = await client.delete(
            f"/api/admin/instructors/{iid}", headers=auth_header(admin_token)
        )
        assert resp.status_code == 204

    async def test_delete_nonexistent(self, client, admin_token, seed_admin_user):
        resp = await client.delete(
            f"/api/admin/instructors/{ObjectId()}", headers=auth_header(admin_token)
        )
        assert resp.status_code == 404


class TestStudentRecords:
    async def test_create_student(self, client, admin_token, seed_admin_user):
        resp = await client.post(
            "/api/admin/students",
            headers=auth_header(admin_token),
            json={
                "full_name": "Test Student",
                "email": "student@test.edu",
                "student_number": "S12345",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["student_number"] == "S12345"

    async def test_create_duplicate_email(
        self, client, admin_token, seed_admin_user, sample_student
    ):
        resp = await client.post(
            "/api/admin/students",
            headers=auth_header(admin_token),
            json={
                "full_name": "Another",
                "email": "jane@test.edu",
                "student_number": "S99999",
            },
        )
        assert resp.status_code == 409

    async def test_create_duplicate_student_number(
        self, client, admin_token, seed_admin_user, sample_student
    ):
        resp = await client.post(
            "/api/admin/students",
            headers=auth_header(admin_token),
            json={
                "full_name": "Another",
                "email": "other@test.edu",
                "student_number": "STU001",
            },
        )
        assert resp.status_code == 409

    async def test_list_students(
        self, client, admin_token, seed_admin_user, sample_student
    ):
        resp = await client.get(
            "/api/admin/students", headers=auth_header(admin_token)
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_update_student(
        self, client, admin_token, seed_admin_user, sample_student
    ):
        sid = str(sample_student["_id"])
        resp = await client.patch(
            f"/api/admin/students/{sid}",
            headers=auth_header(admin_token),
            json={"full_name": "Updated Name"},
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Updated Name"

    async def test_update_nonexistent(self, client, admin_token, seed_admin_user):
        resp = await client.patch(
            f"/api/admin/students/{ObjectId()}",
            headers=auth_header(admin_token),
            json={"full_name": "X"},
        )
        assert resp.status_code == 404

    async def test_delete_student(
        self, client, admin_token, seed_admin_user, sample_student
    ):
        sid = str(sample_student["_id"])
        resp = await client.delete(
            f"/api/admin/students/{sid}", headers=auth_header(admin_token)
        )
        assert resp.status_code == 204

    async def test_delete_nonexistent(self, client, admin_token, seed_admin_user):
        resp = await client.delete(
            f"/api/admin/students/{ObjectId()}", headers=auth_header(admin_token)
        )
        assert resp.status_code == 404


class TestAdminCourses:
    async def test_list_courses(
        self, client, admin_token, seed_admin_user, sample_course
    ):
        resp = await client.get(
            "/api/admin/courses", headers=auth_header(admin_token)
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1
