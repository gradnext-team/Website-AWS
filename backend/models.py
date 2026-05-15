from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum
import uuid


class PlanType(str, Enum):
    FREE_TRIAL = "free_trial"
    BASIC = "basic_plan"      # Standardized to match database plan_key
    PRO = "pro_plan"          # Standardized to match database plan_key
    PRO_PLUS = "pro_plus"
    LAST_MILE = "last_mile"
    MID_MILE = "mid_mile"
    FULL_PREP = "full_prep"
    PINNACLE = "pinnacle"
    COHORT_PREMIUM = "cohort_premium"
    COHORT_ELITE = "cohort_elite"
    SINGLE_SESSION = "single_session"


class UserBase(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None


class UserCreate(UserBase):
    google_id: str


class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    google_id: str
    plan: PlanType = PlanType.FREE_TRIAL
    plan_start_date: Optional[datetime] = None
    plan_end_date: Optional[datetime] = None
    coaching_sessions_total: int = 0
    coaching_sessions_used: int = 0
    cohort_batch: Optional[str] = None
    cohort_id: Optional[str] = None  # ID of the cohort user is enrolled in
    cohort_enrolled_at: Optional[datetime] = None  # When user enrolled
    is_mentor: bool = False
    is_admin: bool = False
    mentor_id: Optional[str] = None
    # Peer practice profile
    peer_rating: float = 5.0
    peer_sessions_done: int = 0
    peer_availability: List[Any] = []  # Can be List[str] or List[dict] for weekly slots
    bio: Optional[str] = None
    target_companies: List[str] = []
    preparation_stage: Optional[str] = None  # "beginner", "intermediate", "advanced"
    custom_access: dict = {}  # Custom access overrides
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    plan: str
    plan_start_date: Optional[datetime] = None
    plan_end_date: Optional[datetime] = None
    coaching_sessions_total: int = 0
    coaching_sessions_used: int = 0
    coaching_sessions_remaining: int = 0
    cohort_batch: Optional[str] = None
    is_mentor: bool = False
    is_admin: bool = False
    mentor_id: Optional[str] = None
    peer_rating: float = 5.0
    peer_sessions_done: int = 0


# Mentor Models
class MentorBase(BaseModel):
    name: str
    title: Optional[str] = None
    company: Optional[str] = None
    bio: Optional[str] = ""
    expertise: List[str] = []
    linkedin: Optional[str] = None
    picture: Optional[str] = None
    years_experience: int = 0
    sessions_conducted: int = 0
    sessions_done: int = 0
    rating: Optional[float] = None  # No default rating - only set after receiving feedback
    hourly_rate: int = 12000  # Rate in INR
    specialization: Optional[str] = None
    availability: List[dict] = []


class Mentor(MentorBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    is_active: bool = True
    status: str = "active"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MentorAvailability(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mentor_id: str
    date: str  # YYYY-MM-DD
    time_slots: List[str]  # ["09:00", "10:00", "14:00", etc.]
    booked_slots: List[str] = []


class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SessionBooking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    mentor_id: str
    date: str
    time_slot: str
    status: BookingStatus = BookingStatus.PENDING
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Resource Models
class VideoLesson(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    duration: str
    module: str
    order: int
    thumbnail: str
    video_url: str
    is_free: bool = False


class Workshop(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    mentor_name: str
    date: str
    time: str
    duration: str
    is_past: bool = False
    recording_url: Optional[str] = None
    is_free: bool = False


class CaseDrill(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    category: str
    difficulty: str  # beginner, intermediate, advanced
    duration: str
    description: str
    is_free: bool = False


class Resource(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    category: str
    description: str
    file_url: str
    is_free: bool = True  # Case interview materials are free for all


class CohortSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    batch: str
    week: int
    title: str
    description: str
    date: str
    time: str
    duration: str
    is_past: bool = False
    recording_url: Optional[str] = None
    deck_url: Optional[str] = None
    meeting_link: Optional[str] = None


# User Progress Models
class UserProgress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    videos_completed: List[str] = []
    drills_completed: List[str] = []
    workshops_attended: List[str] = []
    peer_sessions_count: int = 0
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# Peer Practice Models
class PeerSessionStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PeerSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requester_id: str
    partner_id: str
    date: str
    time_slot: str
    status: PeerSessionStatus = PeerSessionStatus.PENDING
    requester_feedback: Optional[dict] = None  # {rating: 5, comment: "..."}
    partner_feedback: Optional[dict] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Session Feedback Models
class SessionFeedback(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    booking_id: str
    mentor_id: str
    user_id: str
    rating: int  # 1-5
    strengths: List[str] = []
    areas_to_improve: List[str] = []
    case_type: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Mentor Statistics
class MentorStats(BaseModel):
    total_sessions: int = 0
    upcoming_sessions: int = 0
    completed_sessions: int = 0
    total_earnings: float = 0.0
    average_rating: Optional[float] = None  # No default rating - only set after receiving feedback
    pending_feedbacks: int = 0


# Partner API Models
class PartnerStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class Partner(BaseModel):
    """Partner institute that can access mentor availability via API"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact_email: EmailStr
    api_key_hash: str  # Hashed API key (never store plain key)
    api_key_prefix: str  # First 8 chars for identification (e.g., "pk_live_")
    assigned_mentor_ids: List[str] = []  # Mentor IDs this partner can access
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None  # Admin notes about this partner


class PartnerBookingStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class PartnerBooking(BaseModel):
    """Booking made by a partner institute via API"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    partner_id: str  # Which partner created this booking
    mentor_id: str
    date: str  # YYYY-MM-DD
    time_slot: str  # HH:MM
    duration_minutes: int = 45
    session_type: str  # case_interview, fit_interview, resume_review
    candidate_name: str
    candidate_email: EmailStr
    status: PartnerBookingStatus = PartnerBookingStatus.SCHEDULED
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    cancelled_at: Optional[datetime] = None
    cancelled_reason: Optional[str] = None
