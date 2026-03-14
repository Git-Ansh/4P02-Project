"""Tests for auth endpoints: login, universities, theme."""

from datetime import datetime, timezone

from tests.helpers import TEST_PASSWORD, TEST_UNI_SLUG, auth_header


class TestLogin:
    async def test_super_admin_login(self, client, seed_super_admin):
        resp = await client.post(
            "/api/auth/login",
            json={"email": "super@test.com", "password": TEST_PASSWORD},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "super_admin"
        assert "access_token" in data

    async def test_university_user_login(self, client, seed_instructor):
        resp = await client.post(
            "/api/auth/login",
            json={
                "email": "instructor@test.com",
                "password": TEST_PASSWORD,
                "university_slug": TEST_UNI_SLUG,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "instructor"
        assert data["university_slug"] == TEST_UNI_SLUG

    async def test_login_wrong_password(self, client, seed_super_admin):
        resp = await client.post(
            "/api/auth/login",
            json={"email": "super@test.com", "password": "wrongpassword1"},
        )
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client):
        resp = await client.post(
            "/api/auth/login",
            json={"email": "nobody@test.com", "password": "password123"},
        )
        assert resp.status_code == 401

    async def test_login_invalid_university(self, client):
        resp = await client.post(
            "/api/auth/login",
            json={
                "email": "test@test.com",
                "password": "password123",
                "university_slug": "nonexistent-uni",
            },
        )
        assert resp.status_code == 401


class TestUniversities:
    async def test_list_active_universities(self, client, seed_university):
        resp = await client.get("/api/universities")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["slug"] == TEST_UNI_SLUG

    async def test_list_excludes_inactive(self, client, mongo_client):
        from src.config.settings import settings

        db = mongo_client[settings.DB_NAME]
        await db.universities.insert_one(
            {
                "name": "Inactive Uni",
                "slug": "inactive-uni",
                "status": "inactive",
                "created_at": datetime.now(timezone.utc),
            }
        )
        resp = await client.get("/api/universities")
        assert resp.status_code == 200
        slugs = [u["slug"] for u in resp.json()]
        assert "inactive-uni" not in slugs

    async def test_get_university_theme(self, client, seed_university):
        resp = await client.get(f"/api/universities/{TEST_UNI_SLUG}/theme")
        assert resp.status_code == 200
        data = resp.json()
        assert data["slug"] == TEST_UNI_SLUG
        assert data["name"] == "Test University"

    async def test_get_theme_not_found(self, client):
        resp = await client.get("/api/universities/no-such-uni/theme")
        assert resp.status_code == 404
