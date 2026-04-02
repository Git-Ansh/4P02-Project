import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    university_slug: Optional[str] = None
    role: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    university_slug: Optional[str] = None


class UniversityCreate(BaseModel):
    name: str = Field(min_length=1)
    slug: str = Field(min_length=1)
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", v):
            raise ValueError(
                "Slug must be lowercase alphanumeric with hyphens only"
            )
        return v

    @field_validator("primary_color", "secondary_color")
    @classmethod
    def strip_color(cls, v: str | None) -> str | None:
        return v.strip() if v else v


class UniversityResponse(BaseModel):
    id: str
    name: str
    slug: str
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    status: str
    created_at: datetime


class UniversityTheme(BaseModel):
    name: str
    slug: str
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1)
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"admin", "instructor"}
        if v not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(sorted(allowed))}")
        return v


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    created_at: datetime


class DashboardStats(BaseModel):
    universities_count: int
    total_admins: int


class AdminDashboardStats(BaseModel):
    instructor_count: int
    course_count: int


class UniversityUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None

    @field_validator("primary_color", "secondary_color")
    @classmethod
    def strip_color(cls, v: str | None) -> str | None:
        return v.strip() if v else v


class CourseCreate(BaseModel):
    code: str = Field(min_length=1)
    title: str = Field(min_length=1)
    term: str = Field(min_length=1)
    description: Optional[str] = None


class CourseUpdate(BaseModel):
    code: Optional[str] = None
    title: Optional[str] = None
    term: Optional[str] = None
    description: Optional[str] = None


class CourseResponse(BaseModel):
    id: str
    code: str
    title: str
    term: str
    description: Optional[str] = None
    instructor_email: str
    instructor_name: str
    created_at: datetime


class InstructorDashboardStats(BaseModel):
    course_count: int
    total_assignments: int = 0
    total_submissions: int = 0
    submissions_by_assignment: list[dict] = []
    flagged_high_count: int = 0
    flagged_med_count: int = 0
    flagged_low_count: int = 0
    recent_analyses: list[dict] = []
    flagged_pairs: list[dict] = []


class AnalysisRunResponse(BaseModel):
    id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None


class AnalysisReportResponse(BaseModel):
    id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    metadata: Optional[dict] = None
    pairs: Optional[list[dict]] = None


class ReferenceSubmissionResponse(BaseModel):
    id: str
    filename: str
    student_count: int
    uploaded_at: datetime


class AssignmentCreate(BaseModel):
    title: str = Field(min_length=1)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    max_score: float = Field(default=100, gt=0)
    allow_resubmission: bool = False
    language: str = Field(min_length=1)


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    max_score: Optional[float] = Field(default=None, gt=0)
    allow_resubmission: Optional[bool] = None
    language: Optional[str] = None


class AssignmentResponse(BaseModel):
    id: str
    course_id: str
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    max_score: float
    allow_resubmission: bool
    language: str
    created_at: datetime


class UniversityDetailResponse(BaseModel):
    id: str
    name: str
    slug: str
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    status: str
    created_at: datetime
    admin_count: int


# ── Submission Tokens ───────────────────────────────────────────────────────


class SubmissionTokenResponse(BaseModel):
    token: str
    expires_at: datetime


# ── Public Assignment (decoded from token) ──────────────────────────────────


class PublicAssignmentResponse(BaseModel):
    university_name: str
    university_slug: str
    instructor_name: str
    course_code: str
    course_title: str
    assignment_id: str
    assignment_title: str
    assignment_description: Optional[str] = None
    due_date: Optional[datetime] = None
    max_score: float
    allow_resubmission: bool
    language: str


# ── Submissions ─────────────────────────────────────────────────────────────


class SubmissionFileInfo(BaseModel):
    name: str
    size: int


class SubmissionResponse(BaseModel):
    id: str
    assignment_id: str
    course_id: str
    student_name: str
    student_email: str
    student_number: str
    language: str
    comment: Optional[str] = None
    files: list[SubmissionFileInfo]
    submitted_at: datetime


class AnonymousSubmissionResponse(BaseModel):
    id: str
    assignment_id: str
    course_id: str
    language: str
    comment: Optional[str] = None
    files: list[SubmissionFileInfo]
    submitted_at: datetime


