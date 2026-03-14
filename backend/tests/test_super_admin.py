"""Tests for super admin endpoints."""

from bson import ObjectId

from tests.helpers import auth_header


class TestDashboard:
    async def test_dashboard(self, client, super_admin_token, seed_university):
        resp = await client.get(
            "/api/super-admin/dashboard",
            headers=auth_header(super_admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "universities_count" in data
        assert "total_admins" in data

    async def test_forbidden_for_instructor(self, client, instructor_token):
        resp = await client.get(
            "/api/super-admin/dashboard",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 403

    async def test_requires_auth(self, client):
        resp = await client.get("/api/super-admin/dashboard")
        assert resp.status_code in (401, 403)


class TestUniversityCRUD:
    async def test_create_university(self, client, super_admin_token):
        resp = await client.post(
            "/api/super-admin/universities",
            headers=auth_header(super_admin_token),
            json={"name": "New University", "slug": "new-uni", "domain": "new.edu"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "New University"
        assert data["slug"] == "new-uni"

    async def test_create_duplicate_slug(
        self, client, super_admin_token, seed_university
    ):
        resp = await client.post(
            "/api/super-admin/universities",
            headers=auth_header(super_admin_token),
            json={"name": "Dup", "slug": "test-uni"},
        )
        assert resp.status_code == 409

    async def test_list_universities(self, client, super_admin_token, seed_university):
        resp = await client.get(
            "/api/super-admin/universities",
            headers=auth_header(super_admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert "admin_count" in data[0]

    async def test_update_university(self, client, super_admin_token, seed_university):
        uid = str(seed_university["_id"])
        resp = await client.patch(
            f"/api/super-admin/universities/{uid}",
            headers=auth_header(super_admin_token),
            json={"name": "Updated Name"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"

    async def test_update_nonexistent(self, client, super_admin_token):
        resp = await client.patch(
            f"/api/super-admin/universities/{ObjectId()}",
            headers=auth_header(super_admin_token),
            json={"name": "X"},
        )
        assert resp.status_code == 404

    async def test_delete_university(self, client, super_admin_token, seed_university):
        uid = str(seed_university["_id"])
        resp = await client.delete(
            f"/api/super-admin/universities/{uid}",
            headers=auth_header(super_admin_token),
        )
        assert resp.status_code == 204

    async def test_delete_nonexistent(self, client, super_admin_token):
        resp = await client.delete(
            f"/api/super-admin/universities/{ObjectId()}",
            headers=auth_header(super_admin_token),
        )
        assert resp.status_code == 404


class TestAdminCRUD:
    async def test_create_admin(self, client, super_admin_token, seed_university):
        uid = str(seed_university["_id"])
        resp = await client.post(
            f"/api/super-admin/universities/{uid}/admins",
            headers=auth_header(super_admin_token),
            json={
                "email": "newadmin@test.com",
                "password": "password123",
                "full_name": "New Admin",
                "role": "admin",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["role"] == "admin"

    async def test_create_admin_duplicate_email(
        self, client, super_admin_token, seed_university, seed_admin_user
    ):
        uid = str(seed_university["_id"])
        resp = await client.post(
            f"/api/super-admin/universities/{uid}/admins",
            headers=auth_header(super_admin_token),
            json={
                "email": "admin@test.com",
                "password": "password123",
                "full_name": "Dup Admin",
                "role": "admin",
            },
        )
        assert resp.status_code == 409

    async def test_list_admins(
        self, client, super_admin_token, seed_university, seed_admin_user
    ):
        uid = str(seed_university["_id"])
        resp = await client.get(
            f"/api/super-admin/universities/{uid}/admins",
            headers=auth_header(super_admin_token),
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_delete_admin(
        self, client, super_admin_token, seed_university, seed_admin_user
    ):
        uid = str(seed_university["_id"])
        aid = str(seed_admin_user["_id"])
        resp = await client.delete(
            f"/api/super-admin/universities/{uid}/admins/{aid}",
            headers=auth_header(super_admin_token),
        )
        assert resp.status_code == 204

    async def test_delete_nonexistent_admin(
        self, client, super_admin_token, seed_university
    ):
        uid = str(seed_university["_id"])
        resp = await client.delete(
            f"/api/super-admin/universities/{uid}/admins/{ObjectId()}",
            headers=auth_header(super_admin_token),
        )
        assert resp.status_code == 404
