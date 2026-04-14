# Maintenance Manual & Issue Resolution

**Academic FBI — Academic Integrity Enforcement Platform**
COSC 4P02 · Brock University · Group 20 · Winter 2026

---

## Table of Contents

1. [Routine Maintenance](#1-routine-maintenance)
2. [Log Locations & Interpretation](#2-log-locations--interpretation)
3. [Database Maintenance](#3-database-maintenance)
4. [Deployment Update Procedure](#4-deployment-update-procedure)
5. [Issue Resolution Procedures](#5-issue-resolution-procedures)
   - 5.1 [Backend / API Issues](#51-backend--api-issues)
   - 5.2 [Database Issues](#52-database-issues)
   - 5.3 [Analysis Engine Issues](#53-analysis-engine-issues)
   - 5.4 [Frontend Issues](#54-frontend-issues)
   - 5.5 [File Storage Issues](#55-file-storage-issues)
   - 5.6 [Email Issues](#56-email-issues)
   - 5.7 [Authentication Issues](#57-authentication-issues)
6. [Health Monitoring](#6-health-monitoring)
7. [Backup & Recovery](#7-backup--recovery)
8. [Known Issues & Workarounds](#8-known-issues--workarounds)

---

## 1. Routine Maintenance

The following tasks should be performed on a regular schedule to keep the platform healthy.

### Daily (Automated)

The course expiry cleanup task runs automatically once per day inside the FastAPI process. No manual action is required under normal operation.

| Automated task | What it does |
|---|---|
| Course expiry cleanup | Scans all university databases; deletes submission files and MongoDB documents for courses whose `end_date + 30 days` has passed; stamps the course with `data_deleted: True` |

To confirm the task is running, check the logs for this line at startup:

```
INFO: course_expiry - Course expiry cleanup task started (interval: 86400s)
```

And look for daily sweep entries like:

```
INFO: course_expiry - Deleted submission files: /opt/academic-fbi/uploads/brock-university/...
INFO: course_expiry - Course COSC 4P02 (brock-university): marked as data_deleted
```

### Weekly

| Task | How |
|---|---|
| Check disk usage on VPS | `df -h /opt/academic-fbi/uploads` |
| Verify backend health endpoint | `curl https://<vps-ip>:8000/health` |
| Review error logs for recurring failures | See Section 2 |
| Check for courses in grace period | See query below — notify instructors if they haven't downloaded yet |

**Grace period query** — find courses currently in the download window:
```javascript
// Run in MongoDB Atlas → Data Explorer → uni_{slug}.courses
db.courses.find({
  end_date: { $lt: new Date() },
  data_deleted: { $ne: true },
  $expr: {
    $gt: [
      { $add: ["$end_date", 30 * 24 * 60 * 60 * 1000] },
      new Date()
    ]
  }
}, { code: 1, title: 1, instructor_email: 1, end_date: 1 })
```

### Monthly

| Task | How |
|---|---|
| MongoDB Atlas backup verification | Log into Atlas → Backup → verify latest snapshot exists |
| Rotate JWT secret  | See Section 5.7 — JWT rotation procedure |
| Review MongoDB Atlas cluster metrics | Atlas dashboard → Metrics tab |
| Clean up old analysis runs | Use the "Delete All Analysis Runs" button in the instructor UI, or query MongoDB directly |

### Per Semester

| Task | How |
|---|---|
| Archive completed course submissions | Copy `UPLOAD_DIR/{slug}/{course_id}/` to cold storage **before** the 30-day grace period expires |
| Remove inactive instructor accounts | University admin panel → Instructors → Delete |
| Verify Python and Node.js dependency updates | `pip list --outdated`, `npm outdated` |

---

## 1a. Course Expiry — Operational Reference

### How it works

1. Instructor sets a mandatory `end_date` when creating a course (immutable after creation).
2. 15 days before `end_date`: yellow **"Expiring Soon"** badge appears on the instructor's course card and detail page.
3. After `end_date`: orange **"Grace Period"** banner. Instructor has 30 days to download submissions as a ZIP.
4. After `end_date + 30 days`: the nightly cleanup task permanently deletes all submission files and MongoDB submission/analysis documents. The course itself remains visible with a red **"Data Deleted"** badge.

### Changing an end_date (admin escalation)

Instructors cannot change `end_date` via the UI. The process is:

1. Instructor contacts their university admin.
2. Admin contacts the Academic FBI help center (the platform operators).
3. An operator runs the correction script on the backend server:

```bash
cd /path/to/4P02-Project/backend
source venv/bin/activate
python -m scripts.set_course_end_date \
  --slug brock-university \
  --code "COSC 4P02" \
  --end-date 2026-06-30
```

The script interprets the date as noon Toronto time and updates MongoDB directly.

### Manually triggering a cleanup (emergency)

If you need to immediately delete data for a specific course without waiting for the nightly task:

```javascript
// In MongoDB Atlas shell or Compass — replace values as needed
const slug = "brock-university";
const courseCode = "COSC 4P02";
const db = connect(`mongodb+srv://...`).getDB(`uni_${slug}`);
const course = db.courses.findOne({ code: courseCode });
// Then delete submissions, analysis_runs, and stamp the course
db.submissions.deleteMany({ assignment_id: { $in: course.assignment_ids } });
db.courses.updateOne({ _id: course._id }, { $set: { data_deleted: true, data_deleted_at: new Date() } });
```

And delete the files on disk:
```bash
rm -rf /opt/academic-fbi/uploads/{slug}/{course_id}/
```

---

## 2. Log Locations & Interpretation

### Backend Logs (Production — Docker)

```bash
# View live logs
docker compose logs -f backend

# View last 100 lines
docker compose logs --tail=100 backend

# Filter for errors only
docker compose logs backend 2>&1 | grep -i "error\|exception\|traceback"
```

**Log format:**
```
INFO:     uvicorn.access - "POST /api/instructor/courses/... HTTP/1.1" 200 OK
WARNING:  src.services.analysis - prepare_submission_zips: found 12 submission docs in DB
ERROR:    src.services.analysis - Analysis job failed
Traceback (most recent call last):
  ...
```

**Key log prefixes:**

| Prefix | Meaning |
|---|---|
| `INFO: uvicorn.access` | Incoming HTTP request + response status |
| `INFO: uvicorn.error` | Server lifecycle events (startup, shutdown) |
| `WARNING: src.services.analysis` | Non-fatal analysis warnings (missing student dirs, etc.) |
| `ERROR: src.services.*` | Failures in service layer — always investigate |
| `ERROR: src.api.*` | Unhandled exceptions in route handlers |

### Backend Logs (Development — Local)

Uvicorn prints directly to stdout when run with `--reload`. No log file is written by default. To redirect:

```bash
python -m uvicorn src.main:app --reload --host 0.0.0.0 2>&1 | tee backend.log
```

### Frontend Logs (Production — Vercel)

Vercel captures server-side logs from Next.js. Access them via:
- Vercel Dashboard → Project → Deployments → select deployment → **Functions** tab

For client-side errors, instruct users to open browser DevTools → Console.

### Analysis Engine Logs

The engine prints parse errors for individual files to stdout:
```
Error parsing /tmp/analysis_xyz/studentA/main.cpp: ...
```
These are non-fatal — files that fail to parse are skipped. A high volume of parse errors may indicate that students submitted files in an unsupported language or that a ZIP was corrupt.

---

## 3. Database Maintenance

### 3.1 Accessing MongoDB Atlas

1. Log into [https://cloud.mongodb.com](https://cloud.mongodb.com)
2. Select the cluster → **Browse Collections**
3. Select database `academic_fbi` (global) or `uni_{slug}` (per-university)

### 3.2 Useful Maintenance Queries

**Find all analysis runs stuck in "running" status** (may occur if the server was restarted mid-analysis):
```javascript
// Run in MongoDB Atlas Data Explorer or mongosh
db.analysis_runs.find({ status: "running" })

// Fix: mark them as failed
db.analysis_runs.updateMany(
  { status: "running" },
  { $set: { status: "failed", error: "Server restarted during analysis" } }
)
```

**Find large analysis documents** (pairs with many blocks can grow large):
```javascript
db.analysis_runs.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" }, assignment_id: 1, status: 1 } },
  { $sort: { size: -1 } },
  { $limit: 10 }
])
```

**Count submissions per assignment:**
```javascript
db.submissions.aggregate([
  { $group: { _id: "$assignment_id", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

**Delete all analysis runs for a specific assignment:**
```javascript
db.analysis_runs.deleteMany({
  assignment_id: ObjectId("...")
})
```

### 3.3 Index Recommendations

The following indexes should exist for good query performance. Verify them in Atlas → Collections → Indexes:

| Database | Collection | Index |
|---|---|---|
| `uni_{slug}` | `submissions` | `{ assignment_id: 1, submitted_at: -1 }` |
| `uni_{slug}` | `analysis_runs` | `{ assignment_id: 1, status: 1 }` |
| `uni_{slug}` | `reveal_requests` | `{ status: 1 }` |
| `academic_fbi` | `users` | `{ email: 1 }` (unique) |
| `academic_fbi` | `universities` | `{ slug: 1 }` (unique) |

To create a missing index via mongosh:
```javascript
use uni_brock_university
db.submissions.createIndex({ assignment_id: 1, submitted_at: -1 })
```

### 3.4 Storage Estimates

| Data | Approximate size |
|---|---|
| One analysis run (50 students, Java) | 2–8 MB |
| One encrypted submission (10 files) | ~50–200 KB |
| MongoDB document limit | 16 MB per document |

If an analysis run approaches 16 MB (very large classes with many files), the `pairs` array may need to be split across multiple documents. This is not currently implemented but can be added if needed.

---

## 4. Deployment Update Procedure

### 4.1 Standard Code Update (Production VPS)

```bash
# SSH into the VPS
ssh user@<vps-ip>

# Navigate to the project directory
cd /path/to/4P02-Project

# Pull the latest changes
git pull origin main

# Rebuild and restart the backend container
docker compose up -d --build backend

# Verify the container is running
docker compose ps

# Check the health endpoint
curl http://localhost:8000/health
```

The frontend on Vercel deploys automatically when changes are pushed to `main` — no manual steps required.

### 4.2 Dependency Updates

**Backend Python packages:**

```bash
# Activate the virtual environment (or enter the container)
docker compose exec backend bash

# Check for outdated packages
pip list --outdated

# Update a specific package
pip install --upgrade <package-name>

# Regenerate requirements.txt after updates
pip freeze > requirements.txt
```

> Always test after updating `motor`, `fastapi`, `pydantic`, or `tree-sitter` — these are the most likely to introduce breaking changes.

**Frontend Node packages:**

```bash
cd frontend/my-app
npm outdated
npm update
# or for major version bumps:
npm install <package>@latest
```

### 4.3 Environment Variable Changes

If `.env` values change (e.g. rotating `JWT_SECRET`):

```bash
# Edit the .env file
nano backend/.env

# Restart the container to pick up new values
docker compose restart backend

# Verify the change took effect
curl http://localhost:8000/health
```

> Changing `JWT_SECRET` invalidates all active JWT tokens AND all Fernet-encrypted student data. See Section 5.7 for the full JWT rotation procedure.

### 4.4 Rollback Procedure

If a deployment introduces a regression:

```bash
# Find the previous working commit
git log --oneline -10

# Revert to that commit
git checkout <commit-hash>

# Rebuild
docker compose up -d --build backend
```

Or revert the last commit and redeploy:

```bash
git revert HEAD
git push origin main
# Vercel auto-deploys; VPS requires manual docker compose up -d --build
```

---

## 5. Issue Resolution Procedures

### 5.1 Backend / API Issues

---

#### API returns 500 Internal Server Error

**Symptoms:** Frontend shows a generic error; browser console shows 500 response.

**Diagnosis:**
```bash
docker compose logs --tail=50 backend | grep -A 20 "ERROR\|Traceback"
```

**Resolution:**
1. Read the full traceback in the logs — it will point to the exact file and line.
2. Common causes:
   - Malformed MongoDB document (missing required field) → fix the document in Atlas.
   - `UPLOAD_DIR` does not exist or is not writable → `mkdir -p $UPLOAD_DIR && chmod 755 $UPLOAD_DIR`.
   - Missing environment variable → check `.env` is present and `docker compose restart backend`.

---

#### API returns 503 or connection refused

**Symptoms:** Frontend cannot reach the backend at all.

**Diagnosis:**
```bash
docker compose ps          # check backend container status
docker compose logs backend # check startup errors
curl http://localhost:8000/health
```

**Resolution:**
- If container is `Exited`: `docker compose up -d backend` then check logs for startup errors.
- If container is running but health check fails: the database connection is down — see Section 5.2.
- If port 8000 is not reachable from outside: check VPS firewall (`ufw status`) — port 8000 must be open.

---

#### Requests are very slow (>10 seconds)

**Symptoms:** API calls time out or take a long time.

**Diagnosis:**
- Check if an analysis job is running — the engine is CPU-intensive and can temporarily slow other requests.
- Check MongoDB Atlas metrics for high latency or throttling.
- Check VPS CPU usage: `top` or `htop`.

**Resolution:**
- If analysis is running, wait for it to complete.
- If MongoDB is throttling: upgrade the Atlas cluster tier or add indexes (see Section 3.3).
- If VPS is overloaded: upgrade the VPS plan or limit `ProcessPoolExecutor` workers in `comparison_engine.py`.

---

### 5.2 Database Issues

---

#### `RuntimeError: Database client not initialized`

**Symptoms:** Any API request returns 500 immediately after startup.

**Cause:** `connect_db()` was not called (lifespan hook failed) or `MONGODB_URI` is incorrect.

**Resolution:**
```bash
# Check the startup log for connection errors
docker compose logs backend | head -30

# Verify the URI is set
docker compose exec backend env | grep MONGODB_URI

# Test the connection manually
docker compose exec backend python -c "
import asyncio
from src.config.database import connect_db
asyncio.run(connect_db())
print('Connected OK')
"
```

Common fixes:
- Incorrect `MONGODB_URI` in `.env` → fix and `docker compose restart backend`.
- VPS IP not whitelisted in MongoDB Atlas Network Access → add it in the Atlas console.
- MongoDB Atlas cluster is paused (free tier auto-pauses) → resume it in the Atlas console.

---

#### MongoDB Atlas cluster is paused

**Symptoms:** All API requests fail with connection errors; `health` endpoint returns 500.

**Resolution:**
1. Log into [https://cloud.mongodb.com](https://cloud.mongodb.com).
2. Select the cluster → click **Resume**.
3. Wait ~60 seconds for the cluster to start.
4. Verify: `curl http://localhost:8000/health`.

Free-tier clusters auto-pause after 60 days of inactivity. Upgrade to a paid tier or schedule a periodic ping to prevent this.

---

#### Analysis results are missing after server restart

**Symptoms:** An analysis was running when the server restarted; the run shows as "running" indefinitely.

**Resolution:**
```javascript
// In MongoDB Atlas Data Explorer
use uni_{slug}
db.analysis_runs.updateMany(
  { status: "running" },
  { $set: { status: "failed", error: "Server restart during analysis — please re-run" } }
)
```

Then trigger a new analysis from the instructor UI.

---

### 5.3 Analysis Engine Issues

---

#### Analysis job completes but shows 0 pairs

**Symptoms:** Analysis status shows "completed" but the pair list is empty.

**Diagnosis checklist:**
1. Verify submissions exist: check the submissions page for the assignment.
2. Check the analysis metadata in MongoDB — look at `candidate_pairs_evaluated`.
3. Check if all fingerprints were filtered by boilerplate: look at `boilerplate_hashes_filtered` in metadata.
4. Check the backend log for `prepare_submission_zips: found X submission docs` — if X < 2, there are not enough submissions to compare.

**Resolution by cause:**

| Cause | Fix |
|---|---|
| Fewer than 2 submissions | Wait for more students to submit |
| All hashes filtered by boilerplate | The boilerplate files may be too broad — remove or narrow them |
| All submissions failed to parse | Check the engine log for parse errors; verify language setting matches submitted files |
| `SIMILARITY_THRESHOLD` too high | Currently hardcoded at 0 in the engine — not a user-configurable value |

---

#### Analysis job fails with "failed" status

**Symptoms:** Analysis run shows status `failed` with an error message.

**Diagnosis:**
```bash
# Check the full error in MongoDB
# Atlas Data Explorer → uni_{slug} → analysis_runs → find the failed run
# Look at the "error" field
```

Or via logs:
```bash
docker compose logs backend | grep -A 30 "Analysis job failed"
```

**Common causes:**

| Error message | Cause | Fix |
|---|---|---|
| `No such file or directory: UPLOAD_DIR` | Upload directory missing | `mkdir -p $UPLOAD_DIR` |
| `decrypt_bytes failed` | JWT_SECRET changed after submissions were encrypted | Restore original JWT_SECRET or re-encrypt files |
| `BadZipFile` | A student's submission ZIP is corrupt | Delete the corrupt submission and ask student to resubmit |
| `MemoryError` | Very large class (100+ students) exhausting RAM | Upgrade VPS RAM; or reduce `ProcessPoolExecutor` workers |

---

#### Engine produces too many false positives

**Symptoms:** Pairs are flagged that share only common boilerplate or starter code.

**Resolution:**
1. Upload the assignment's starter/template code as **Boilerplate** (via the References page in the instructor UI).
2. Re-run the analysis — the engine will fingerprint and subtract the boilerplate hashes.
3. If the issue persists, the boilerplate files may need to include all provided utility functions, not just the main template.

---

#### Engine is very slow for large classes

**Symptoms:** Analysis takes >5 minutes for 30+ students.

**Resolution:**
- The engine already uses `ProcessPoolExecutor` for parallel fingerprinting. Performance is primarily limited by CPU cores.
- Ensure the VPS has at least 4 cores for classes of 50+ students.
- Check for corrupt ZIPs that are causing repeated extraction failures (visible in logs).
- If using reference repositories, ensure they are not excessively large (>1000 files).

---

### 5.4 Frontend Issues

---

#### Frontend shows "Request failed" or blank page after login

**Symptoms:** Login succeeds but dashboard does not load; network tab shows API errors.

**Diagnosis:**
1. Open browser DevTools → Network tab.
2. Look for failing API requests — check the response body for the `detail` field.
3. Check if `NEXT_PUBLIC_API_URL` points to the correct backend URL.

**Resolution:**
- Mismatched API URL: update `NEXT_PUBLIC_API_URL` in Vercel environment variables and redeploy.
- CORS error: the frontend origin is not in the backend's allowed list → add it to `allow_origin_regex` in `backend/src/main.py`.
- Backend is down: follow Section 5.1 procedures.

---

#### Side-by-side diff viewer shows no highlights

**Symptoms:** Pair detail page loads but no code is highlighted.

**Diagnosis:**
1. Open DevTools → Console for JavaScript errors.
2. Check that `pair.blocks` is not empty (visible in the Network tab response for the pair API call).
3. Check that `pair.sources` contains the source code strings.

**Resolution:**
- If `pair.blocks` is empty, the analysis produced no blocks — this is an engine issue (see Section 5.3).
- If `pair.sources` is empty, the source code was not stored during analysis — re-run the analysis.
- If blocks exist but no highlight appears, check the active file tab — the highlights may be on a different file tab.

---

#### Students cannot access the submission portal

**Symptoms:** Students report the submission link is expired or invalid.

**Diagnosis:**
1. Ask the instructor to regenerate the assignment token.
2. Check if the assignment's due date has passed (the portal may reject late submissions if `allow_resubmission` is false).

**Resolution:**
- Regenerate token: Instructor UI → Assignment → Generate Token → share new link.
- Extend due date: Instructor UI → Assignment → Edit → update due date.

---

### 5.5 File Storage Issues

---

#### Submission uploads succeed but files are missing from disk

**Symptoms:** Submission appears in the database but analysis finds no files for that student.

**Diagnosis:**
```bash
# Check the upload directory
ls -la $UPLOAD_DIR/{slug}/{course_id}/{assignment_id}/

# Check file count for a specific student
ls -la $UPLOAD_DIR/{slug}/{course_id}/{assignment_id}/{submission_id}/
```

**Resolution:**
- If the directory is missing: `UPLOAD_DIR` may have changed between the submission and the analysis. Ensure it is consistent in `.env`.
- If the container restarted with a different volume mount: check `docker-compose.yml` volume configuration.
- If files are there but analysis skips them: check the file extensions — the engine only processes `.java`, `.cpp`, `.c`, `.h`, `.hpp`.

---

#### Disk space is running low

**Symptoms:** Upload fails with "No space left on device"; health check returns errors.

**Resolution:**
```bash
# Check disk usage
df -h

# Find largest directories under UPLOAD_DIR
du -sh $UPLOAD_DIR/*/* | sort -rh | head -20

# Remove old analysis temp directories (safe to delete)
find /tmp -name "analysis_*" -type d -mtime +1 -exec rm -rf {} +
```

If disk is still low, archive old course submission directories to external storage and remove them from the VPS.

---

### 5.6 Email Issues

---

#### Students are not receiving submission receipt emails

**Symptoms:** Submission succeeds but no email arrives.

**Diagnosis:**
```bash
docker compose logs backend | grep -i "email\|brevo\|smtp"
```

**Resolution by log message:**

| Log message | Cause | Fix |
|---|---|---|
| `No email provider configured — skipping` | Neither Brevo nor SMTP is configured | Add `BREVO_API_KEY` or SMTP settings to `.env` |
| `Brevo API error 401` | Invalid or expired Brevo API key | Regenerate key in Brevo dashboard and update `.env` |
| `Failed to send submission receipt` + exception | Network error or bad credentials | Check the exception detail; verify credentials |
| `Email sent via Brevo to ...` | Email was sent successfully | Issue is with student's spam filter — check junk folder |

---

### 5.7 Authentication Issues

---

#### All users are suddenly logged out / tokens rejected

**Symptoms:** 401 responses across the board; all users must log in again.

**Cause:** `JWT_SECRET` was changed. All previously issued tokens are now invalid.

**When this is intentional** (e.g. security incident): change `JWT_SECRET` in `.env` and restart the backend — all sessions are invalidated immediately.

**When this is accidental** (e.g. `.env` was overwritten):
1. Restore the original `JWT_SECRET` value.
2. Restart the backend: `docker compose restart backend`.
3. Existing sessions will work again.

> **Warning:** If `JWT_SECRET` is changed, the Fernet encryption key (derived from `JWT_SECRET`) also changes. All encrypted student data stored in MongoDB (names, emails) becomes unreadable, and encrypted files on disk become unrecoverable. **Never change `JWT_SECRET` on a system with existing submissions without first decrypting and re-encrypting all data.**

---

#### JWT rotation procedure (planned key change)

If a key rotation is required for security policy compliance:

1. **Decrypt all encrypted fields** using the old key:
   ```python
   from src.utils.encryption import decrypt_string
   # Run against all submission documents in MongoDB
   ```
2. Update `JWT_SECRET` in `.env`.
3. **Re-encrypt all fields** using the new key:
   ```python
   from src.utils.encryption import encrypt_string
   ```
4. Re-encrypt all files on disk.
5. Restart the backend.

This procedure requires a custom migration script — contact the development team before attempting.

---

#### A user cannot log in despite correct credentials

**Symptoms:** Login returns 401 even with the correct password.

**Diagnosis:**
```javascript
// Check the user document in MongoDB
use academic_fbi
db.users.findOne({ email: "user@example.com" })
```

**Resolution:**
- If the document exists: reset the password hash directly in MongoDB:
  ```python
  # Generate a new bcrypt hash
  from src.services.auth import hash_password
  print(hash_password("newpassword"))
  ```
  Then update the `password` field in Atlas.
- If the document does not exist: the account was not created — use the admin UI or `seed_super_admin.py` to create it.
- Check `university_slug` in the login request matches the user's university.

---

## 6. Health Monitoring

### Automated Health Check

The backend exposes a health endpoint that verifies both the API process and the database connection:

```
GET /health
→ 200 {"status": "ok", "database": "connected"}
→ 500 if MongoDB is unreachable
```

Set up an external monitoring service (UptimeRobot, BetterUptime, etc.) to ping this URL every 5 minutes and alert on failure.

### Manual Health Checklist

Run these checks after any deployment or incident:

```bash
# 1. Backend health
curl https://<vps-ip>:8000/health

# 2. Container status
docker compose ps

# 3. Recent error logs
docker compose logs --tail=50 backend | grep -i "error\|exception"

# 4. Disk space
df -h /opt/academic-fbi/uploads

# 5. MongoDB Atlas — check in the Atlas console:
#    - Cluster is active (not paused)
#    - No replication lag alerts
#    - Storage below 80% of tier limit

# 6. Frontend — visit the Vercel deployment URL
#    - Landing page loads
#    - Login works with test credentials
```

---

## 7. Backup & Recovery

### 7.1 Database Backup

MongoDB Atlas automatically backs up all data on a continuous basis (M10+ clusters) or daily snapshots (M0 free tier).

**Manual backup via mongodump:**
```bash
mongodump --uri="mongodb+srv://<user>:<pass>@<cluster>/" --out=/backup/$(date +%Y%m%d)
```

**Restore from backup:**
```bash
mongorestore --uri="mongodb+srv://<user>:<pass>@<cluster>/" /backup/20260414/
```

### 7.2 File Storage Backup

Encrypted submission files are stored on the VPS disk. Back them up to an external location:

```bash
# Compress and copy to external storage
tar -czf /backup/uploads-$(date +%Y%m%d).tar.gz /opt/academic-fbi/uploads/

# Or use rsync to a remote server
rsync -avz /opt/academic-fbi/uploads/ backup-server:/backups/academic-fbi/
```

### 7.3 Recovery Procedure

If the VPS is lost and must be rebuilt:

1. Provision a new Ubuntu 22.04 VPS.
2. Clone the repository.
3. Restore `.env` from a secure backup.
4. Create the upload directory: `mkdir -p /opt/academic-fbi/uploads`.
5. Restore files: `tar -xzf uploads-backup.tar.gz -C /`.
6. Start the containers: `docker compose up -d --build`.
7. Verify health endpoint.

> The MongoDB data is safe in Atlas — it does not need to be restored from VPS backups.

---

## 8. Known Issues & Workarounds

### Analysis runs stuck on "running" after server restart

**Issue:** If the server is restarted while an analysis job is running (in a background thread), the job status remains "running" indefinitely since it is tracked in-memory.

**Workaround:** Manually update stuck runs in MongoDB:
```javascript
db.analysis_runs.updateMany(
  { status: "running" },
  { $set: { status: "failed", error: "Server restart — please re-run analysis" } }
)
```

**Long-term fix:** Implement a persistent job queue (e.g. Celery + Redis) so jobs survive server restarts.

---

### Large analysis reports approaching MongoDB 16 MB document limit

**Issue:** For very large classes (80+ students with many files), the `analysis_runs` document containing all pairs and source code may approach MongoDB's 16 MB document size limit.

**Workaround:** Delete unused analysis runs for the assignment, or reduce the number of source files stored per submission.

**Long-term fix:** Store `pairs[].sources` in a separate `analysis_sources` collection and reference by pair ID.

---

### Tree-sitter fails to parse some valid C++ files

**Issue:** Complex C++ template metaprogramming or non-standard compiler extensions may cause Tree-sitter to produce incomplete ASTs, resulting in that file being skipped with a parse error logged.

**Workaround:** The engine skips unparseable files gracefully — the analysis still runs on all other files. No action required unless the skipped file contains the suspected plagiarised code.

---

### Python 3.12+ is not supported

**Issue:** The project requires Python 3.11. Python 3.12 introduced breaking changes in `motor` and async behaviour that cause import errors.

**Workaround:** Always use Python 3.11 for the backend. The Dockerfile enforces this with `FROM python:3.11-slim`.

---

### Free-tier MongoDB Atlas cluster auto-pauses

**Issue:** MongoDB Atlas M0 (free) clusters automatically pause after 60 days of inactivity, causing the backend health check to fail.

**Workaround:** Resume the cluster manually in the Atlas console. To prevent it: set up a scheduled ping to the `/health` endpoint, or upgrade to a paid Atlas tier.

---

*End of Maintenance Manual & Issue Resolution*
