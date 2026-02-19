# User Guide

User documentation for **Academic FBI** — the Academic Integrity Submission and Similarity Analysis System.

## Roles

The system defines three user roles, each with distinct capabilities.

### Student

Students interact with the system to submit code for assignments.

- **Select institution** — Choose your institution from the landing page
- **Verify assignment key** — Enter the assignment key provided by your instructor to access the upload portal
- **Upload submission** — Upload source code files (C, C++, or Java) for the assignment
- **Resubmit** — Replace a previous submission before the assignment deadline

> Students never see other students' submissions or similarity results. All data is anonymized.

### Instructor

Instructors manage courses, run analysis, and review results.

- **Manage courses and assignments** — Create courses, create assignments with deadlines and language settings, and distribute assignment keys to students
- **Manage repositories** — Upload or select comparison repositories (previous offerings, custom code bases) to include in analysis
- **Run analysis** — Trigger similarity analysis on all submissions for an assignment
- **View reports** — Review per-pair similarity scores, flagged submissions, and aggregate statistics
- **Compare submissions** — Open a side-by-side highlighted diff of two flagged submissions
- **Export / download** — Export reports as PDF or CSV; download raw submissions

### Administrator

Administrators oversee the platform.

- **Manage instructors and courses** — Create and deactivate instructor accounts; assign instructors to courses
- **Configure global settings** — Set system-wide parameters (similarity thresholds, supported languages, storage limits)
- **View activity logs** — Monitor system usage, analysis job history, and audit trails
