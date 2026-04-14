# User Manual

**Academic FBI — Academic Integrity Enforcement Platform**
COSC 4P02 · Brock University · Group 20 · Winter 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Logging In](#2-logging-in)
3. [Super Admin](#3-super-admin)
4. [University Admin](#4-university-admin)
5. [Instructor](#5-instructor)
6. [Student — Submission Portal](#6-student--submission-portal)

---

## 1. Introduction

Academic FBI is a source-code plagiarism detection platform for academic institutions. It lets instructors collect student code submissions, run multi-stage similarity analysis, and review flagged pairs in a side-by-side diff viewer — all while keeping student identities anonymous until an explicit reveal is approved.

**Who uses what:**

| Role | What they do |
|---|---|
| **Super Admin** | Creates and manages universities and their administrators |
| **University Admin** | Creates instructors; oversees courses across the institution |
| **Instructor** | Creates courses and assignments; collects submissions; runs analysis |
| **Student** | Submits code via a public link — no account required |

---

## 2. Logging In

1. Go to the platform URL ( `https://your-deployment.vercel.app`).
2. The landing page shows a list of institutions. Click your institution.
3. On the login page enter your **email** and **password**.
4. You are redirected to your role's dashboard automatically.

> Students do **not** log in. They access the submission portal through a unique assignment link sent by their instructor.

---

## 3. Super Admin

The super admin has platform-wide access. There is only one super admin account, created during initial setup.

### 3.1 Dashboard

The super admin dashboard shows:
- Total number of universities on the platform
- Total number of university administrators

### 3.2 Managing Universities

#### Create a University

1. Go to **Universities** → **Create University**.
2. Fill in:
   - **Name** — full institution name (e.g. *Brock University*)
   - **Slug** — short URL identifier, lowercase with hyphens (e.g. `brock-university`). This cannot be changed after creation.
   - **Domain** *(optional)* — institution email domain (e.g. `brocku.ca`)
   - **Logo URL** *(optional)* — publicly accessible image URL for branding
   - **Primary / Secondary Colour** *(optional)* — hex colour codes for the institution's theme
3. Click **Create**. The university is created with status *active*.

#### View / Edit a University

- Click a university name to open its detail page.
- You can update the name, domain, logo URL, and colours.
- The slug is permanent.

#### Deactivate a University

On the university detail page, use the status toggle to deactivate. Deactivated universities no longer appear in the student submission portal's institution picker.

### 3.3 Managing University Administrators

#### Create an Admin Account

1. Open a university's detail page.
2. Click **Create Admin Account**.
3. Enter the admin's **full name**, **email**, and a **temporary password**.
4. The admin can log in immediately and should change their password.

#### View Admins

The university detail page lists all admins for that institution with their email and creation date.

---

## 4. University Admin

University admins manage instructors and have read-only visibility into all courses at their institution.

### 4.1 Dashboard

Shows:
- Number of instructors at the university
- Total number of courses across all instructors

### 4.2 Managing Instructors

#### Create an Instructor

1. Go to **Instructors** → **Create Instructor**.
2. Enter the instructor's **full name**, **email**, and **password**.
3. Click **Create**. The instructor can log in immediately.

#### View Instructors

The instructors list shows name, email, and account creation date.

### 4.3 Course Overview

Go to **Courses** to see all courses created by all instructors at your institution. You can view course details and submission counts but cannot edit them — that is the instructor's responsibility.

### 4.4 Identity Reveal Approvals

When an instructor requests to reveal a flagged student's real identity, the request comes to the university admin for approval.

1. Go to **Reveal Requests**.
2. Review the request — it shows the anonymous label (e.g. *Student A*) and the assignment.
3. Click **Approve** or **Deny**.
4. Once approved, the instructor can see the student's real name and email on the analysis page.

---

## 5. Instructor

Instructors create courses and assignments, collect student submissions, and run plagiarism analysis.

### 5.1 Dashboard

The instructor dashboard shows:
- Total courses, assignments, and submissions
- Recent analysis runs with their status
- Top flagged pairs across all assignments, sorted by severity

### 5.2 Courses

#### Create a Course

1. Go to **Courses** → **Add Course**.
2. Fill in:
   - **Course Code** — e.g. `COSC 4P02`
   - **Title** — e.g. *Software Engineering II*
   - **Course End Date** — the last day of the course. **This cannot be changed after creation.** Contact your university admin if a correction is needed.
   - **Description** *(optional)*
3. The **term** (e.g. *Winter 2026*, *Fall/Winter 2025-2026*) is determined automatically from the end date — you do not need to enter it.
4. Click **Create Course**.

> **Course end date policy:** After the end date, you have a **30-day grace period** to download your submissions. After 30 days, all student submission data is permanently deleted from the system to comply with data retention requirements. The course record itself remains visible.

#### Course Expiry Indicators

| Badge | Meaning | Action required |
|---|---|---|
| Yellow — *Expiring Soon* | End date is within 15 days | Prepare to download submissions |
| Orange — *Grace Period* | End date has passed, < 30 days ago | Download submissions immediately |
| Red — *Data Deleted* | 30 days past end date | Submission data is gone — course record only |

Each course card shows the end date and, during the grace period, the exact deletion deadline.

#### Edit a Course

Click **Edit** on a course card to update the code, title, or description. The end date and term are locked.

#### Delete a Course

Click the delete (trash) icon on a course card. This permanently removes the course and all its assignments. Confirm in the dialog.

### 5.3 Assignments

Navigate into a course to manage its assignments.

#### Create an Assignment

1. Click **Add Assignment**.
2. Fill in:
   - **Title** — e.g. *Assignment 2 — Linked List*
   - **Language** — Java, C, or C++
   - **Max Score** — default 100
   - **Due Date** *(optional)*
   - **Allow Resubmission** — if enabled, students can replace their submission before the due date
   - **Description** *(optional)*
3. Click **Create Assignment**.

#### Generate a Student Submission Link

Each assignment has a unique access token that students use to submit.

1. Click the **Key** icon next to an assignment.
2. A token is generated (valid for 7 days). Copy the token or the full submission URL.
3. Share the link with students via email or your LMS.

> Tokens expire after 7 days. Generate a new one when needed — previous submissions are not affected.

#### Edit / Delete an Assignment

Use the **Edit** (pencil) and **Delete** (trash) buttons in the assignment row.

### 5.4 Viewing Submissions

1. Click the **Submissions** (clipboard) icon on an assignment.
2. A list of all submissions appears. Student identities are anonymised (Student A, Student B, …).
3. You can see submission date, language, files, and any comment left by the student.

#### Download All Submissions

Click **Download All as ZIP** to get a ZIP archive of all submissions for that assignment, anonymised.

> If the course is in grace period, download your submissions before the deletion deadline shown in the banner.

### 5.5 Running Plagiarism Analysis

#### Trigger Analysis

1. Open an assignment.
2. Click **Run Analysis**. The job starts in the background.
3. The status changes from *running* → *completed* (refresh the page to check — typically takes 30 seconds to a few minutes depending on submission count).

#### Reading the Analysis Report

The report shows a list of flagged submission pairs ranked by severity:

| Severity | Score range | Meaning |
|---|---|---|
| High | ≥ 0.70 | Strong similarity — likely plagiarism |
| Medium | 0.40 – 0.69 | Moderate similarity — worth reviewing |
| Low | < 0.40 | Minor similarity — probably coincidental |

Each row shows two anonymous student labels, their similarity score, and the highest-confidence match block.

#### Viewing a Flagged Pair

Click any flagged pair to open the **side-by-side diff viewer**:
- Left panel shows Student A's code; right panel shows Student B's code.
- Matching blocks are highlighted in the same colour.
- Hover over a highlighted block to see the confidence level (HIGH / MEDIUM / LOW) and how many times that block appears across submissions.
- Use the block navigation arrows to jump between matches.

#### Requesting an Identity Reveal

If you need to know who a flagged student really is:

1. In the pair detail view, click **Request Reveal** next to the anonymous label.
2. The request is sent to your university admin for approval.
3. Once approved, the real name and email appear in place of the anonymous label.

#### Uploading Reference Submissions

To compare against previous offerings:

1. On the assignment page, click **Upload References**.
2. Upload a ZIP file where each inner ZIP is one previous student's submission.
3. Run analysis — the engine will flag similarities with the reference set using a distinct *Ref A*, *Ref B* label.

#### Uploading Boilerplate / Template Code

If you provided starter code to students, upload it as boilerplate so it is excluded from similarity scoring:

1. Click **Upload Boilerplate**.
2. Upload the template file(s).
3. Re-run analysis — template code fingerprints are subtracted before scoring.

---

## 6. Student — Submission Portal

Students do not need an account. They submit through a public link shared by their instructor.

### 6.1 Accessing the Submission Portal

1. Open the assignment link provided by your instructor. It looks like:
   ```
   https://<platform-url>/submit/<token>
   ```
2. The portal shows:
   - University name and instructor
   - Course code and title
   - Assignment title and description
   - Due date (if set) and allowed file types

### 6.2 Submitting Your Code

1. Fill in your details:
   - **Full Name**
   - **Student Email** (your institutional email)
   - **Student Number**
2. Select your **source files**. Accepted formats:
   - `.java` for Java assignments
   - `.c` / `.h` for C assignments
   - `.cpp` / `.hpp` / `.h` for C++ assignments
   - Or a single `.zip` containing your files
3. Optionally add a **comment** (e.g. known issues, notes for the instructor).
4. Click **Submit**.

### 6.3 Submission Confirmation

After submitting you will see a confirmation message on screen. A receipt is also sent to your student email (if email is configured on the platform).

> Keep the confirmation — it is your proof of submission.

### 6.4 Resubmitting

If the assignment allows resubmission and the due date has not passed:

1. Open the same assignment link.
2. Enter your details exactly as before (same email and student number).
3. Upload your updated files and click **Submit**.

Your previous submission is replaced. Only the latest submission is used for analysis.

### 6.5 Privacy

- Your name, email, and student number are **encrypted at rest** using AES-128 encryption.
- Instructors see anonymised labels (Student A, Student B) in analysis results.
- Your real identity is only revealed if your instructor submits a formal request that is approved by the university administrator.
- Submission data is automatically deleted 30 days after the course end date.

---

*End of User Manual*
