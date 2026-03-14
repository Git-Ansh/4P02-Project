"""Tests for instructor analysis, references, and templates."""

from datetime import datetime, timezone

from bson import ObjectId

from tests.helpers import TEST_UNI_SLUG, auth_header


class TestReferences:
    async def test_list_empty(self, client, instructor_token, sample_assignment):
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}/assignments/{aid}/references",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_upload_non_zip(self, client, instructor_token, sample_assignment):
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.post(
            f"/api/instructor/courses/{cid}/assignments/{aid}/references",
            headers=auth_header(instructor_token),
            files={"file": ("test.txt", b"not a zip", "text/plain")},
        )
        assert resp.status_code == 400

    async def test_delete_nonexistent(
        self, client, instructor_token, sample_assignment
    ):
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.delete(
            f"/api/instructor/courses/{cid}/assignments/{aid}/references/{ObjectId()}",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 404

    async def test_upload_and_list_reference(
        self, client, instructor_token, sample_assignment
    ):
        import io
        import zipfile

        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("student1/Main.java", "class Main {}")
        buf.seek(0)

        resp = await client.post(
            f"/api/instructor/courses/{cid}/assignments/{aid}/references",
            headers=auth_header(instructor_token),
            files={"file": ("refs.zip", buf.getvalue(), "application/zip")},
        )
        assert resp.status_code == 201
        ref_id = resp.json()["id"]

        resp = await client.get(
            f"/api/instructor/courses/{cid}/assignments/{aid}/references",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 200
        assert any(r["id"] == ref_id for r in resp.json())


class TestTemplates:
    async def test_list_empty(self, client, instructor_token, sample_assignment):
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}/assignments/{aid}/template",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_delete_nonexistent(
        self, client, instructor_token, sample_assignment
    ):
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.delete(
            f"/api/instructor/courses/{cid}/assignments/{aid}/template/nonexistent.java",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 404

    async def test_upload_and_list_template(
        self, client, instructor_token, sample_assignment
    ):
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.post(
            f"/api/instructor/courses/{cid}/assignments/{aid}/template",
            headers=auth_header(instructor_token),
            files={"file": ("Boilerplate.java", b"class Boilerplate {}", "text/plain")},
        )
        assert resp.status_code == 201

        resp = await client.get(
            f"/api/instructor/courses/{cid}/assignments/{aid}/template",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 200
        filenames = [f["filename"] for f in resp.json()]
        assert "Boilerplate.java" in filenames


class TestAnalysisRun:
    async def test_get_no_analysis(self, client, instructor_token, sample_assignment):
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}/assignments/{aid}/analysis",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 404

    async def test_get_completed_analysis(
        self, client, instructor_token, sample_assignment, mongo_client
    ):
        db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
        now = datetime.now(timezone.utc)
        await db.analysis_runs.insert_one(
            {
                "assignment_id": sample_assignment["_id"],
                "course_id": sample_assignment["course_id"],
                "status": "completed",
                "started_at": now,
                "completed_at": now,
                "error": None,
                "report": {
                    "metadata": {"total_students": 2, "pairs_flagged": 1},
                    "pairs": [
                        {
                            "pair_id": "s1_s2",
                            "student_1": "STU001",
                            "student_2": "STU002",
                            "similarity": 0.85,
                            "severity_score": 0.7,
                            "summary": {},
                            "blocks": [],
                            "files": {"STU001": {}, "STU002": {}},
                            "sources": {"STU001": {}, "STU002": {}},
                        }
                    ],
                },
            }
        )
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}/assignments/{aid}/analysis",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        pair = data["pairs"][0]
        assert pair["student_1"].startswith("Student")
        assert pair["student_2"].startswith("Student")

    async def test_get_pair(
        self, client, instructor_token, sample_assignment, mongo_client
    ):
        db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
        now = datetime.now(timezone.utc)
        await db.analysis_runs.insert_one(
            {
                "assignment_id": sample_assignment["_id"],
                "course_id": sample_assignment["course_id"],
                "status": "completed",
                "started_at": now,
                "completed_at": now,
                "report": {
                    "metadata": {},
                    "pairs": [
                        {
                            "pair_id": "s1_s2",
                            "student_1": "STU001",
                            "student_2": "STU002",
                            "similarity": 0.5,
                            "severity_score": 0.4,
                            "summary": {},
                            "blocks": [],
                            "files": {"STU001": {}, "STU002": {}},
                            "sources": {"STU001": {}, "STU002": {}},
                        }
                    ],
                },
            }
        )
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}/assignments/{aid}/analysis/pair_0",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 200
        assert resp.json()["pair_id"] == "pair_0"

    async def test_get_pair_not_found(
        self, client, instructor_token, sample_assignment, mongo_client
    ):
        db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
        now = datetime.now(timezone.utc)
        await db.analysis_runs.insert_one(
            {
                "assignment_id": sample_assignment["_id"],
                "course_id": sample_assignment["course_id"],
                "status": "completed",
                "started_at": now,
                "completed_at": now,
                "report": {"metadata": {}, "pairs": []},
            }
        )
        cid = str(sample_assignment["course_id"])
        aid = str(sample_assignment["_id"])
        resp = await client.get(
            f"/api/instructor/courses/{cid}/assignments/{aid}/analysis/pair_99",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 404

    async def test_recent_analyses(self, client, instructor_token, sample_course):
        resp = await client.get(
            "/api/instructor/analysis/recent",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_delete_nonexistent(self, client, instructor_token, seed_instructor):
        resp = await client.delete(
            f"/api/instructor/analysis/{ObjectId()}",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 404

    async def test_delete_analysis(
        self, client, instructor_token, sample_assignment, mongo_client
    ):
        db = mongo_client[f"uni_{TEST_UNI_SLUG}"]
        now = datetime.now(timezone.utc)
        result = await db.analysis_runs.insert_one(
            {
                "assignment_id": sample_assignment["_id"],
                "course_id": sample_assignment["course_id"],
                "status": "completed",
                "started_at": now,
                "completed_at": now,
                "report": {"metadata": {}, "pairs": []},
            }
        )
        run_id = str(result.inserted_id)
        resp = await client.delete(
            f"/api/instructor/analysis/{run_id}",
            headers=auth_header(instructor_token),
        )
        assert resp.status_code == 204


class TestDashboard:
    async def test_instructor_dashboard(
        self, client, instructor_token, sample_course
    ):
        resp = await client.get(
            "/api/instructor/dashboard", headers=auth_header(instructor_token)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "course_count" in data
        assert "total_assignments" in data
        assert "total_submissions" in data
        assert data["course_count"] >= 1
