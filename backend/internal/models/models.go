package models

import (
	"time"

	"github.com/google/uuid"
)

// User represents teachers, admins, and academic personnel (Aligned with Better Auth)
type User struct {
	ID            string    `gorm:"primaryKey;type:varchar(64)" json:"id"`
	Email         string    `gorm:"uniqueIndex;not null;type:varchar(255)" json:"email"`
	Name          string    `gorm:"not null;type:varchar(255)" json:"name"`
	EmailVerified bool      `gorm:"default:false" json:"emailVerified"`
	Image         string    `gorm:"type:text" json:"image,omitempty"`
	Role          string    `gorm:"type:varchar(32);default:'TEACHER'" json:"role"` // ADMIN, TEACHER, DEPT_HEAD, ACADEMIC, ADVISOR
	Department    string    `gorm:"type:varchar(100)" json:"department,omitempty"` // กลุ่มสาระการเรียนรู้
	PasswordHash  string    `gorm:"type:text" json:"-"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

func (User) TableName() string {
	return "user"
}

// Session represents Better Auth sessions
type Session struct {
	ID        string    `gorm:"primaryKey;type:varchar(64)" json:"id"`
	UserID    string    `gorm:"not null;index;type:varchar(64)" json:"userId"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	Token     string    `gorm:"uniqueIndex;not null;type:varchar(255)" json:"token"`
	ExpiresAt time.Time `gorm:"not null" json:"expiresAt"`
	IPAddress string    `gorm:"type:varchar(64)" json:"ipAddress,omitempty"`
	UserAgent string    `gorm:"type:text" json:"userAgent,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (Session) TableName() string {
	return "session"
}

// Account represents Better Auth OAuth/Credential accounts
type Account struct {
	ID           string     `gorm:"primaryKey;type:varchar(64)" json:"id"`
	UserID       string     `gorm:"not null;index;type:varchar(64)" json:"userId"`
	User         User       `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	AccountID    string     `gorm:"not null;type:varchar(255)" json:"accountId"`
	ProviderID   string     `gorm:"not null;type:varchar(64)" json:"providerId"` // google, credential
	AccessToken            string     `gorm:"type:text" json:"accessToken,omitempty"`
	RefreshToken           string     `gorm:"type:text" json:"refreshToken,omitempty"`
	IDToken                string     `gorm:"type:text" json:"idToken,omitempty"`
	AccessTokenExpiresAt   *time.Time `json:"accessTokenExpiresAt,omitempty"`
	RefreshTokenExpiresAt  *time.Time `json:"refreshTokenExpiresAt,omitempty"`
	Scope                  string     `gorm:"type:text" json:"scope,omitempty"`
	ExpiresAt              *time.Time `json:"expiresAt,omitempty"`
	Password               string     `gorm:"type:text" json:"-"`
	CreatedAt              time.Time  `json:"createdAt"`
	UpdatedAt              time.Time  `json:"updatedAt"`
}

func (Account) TableName() string {
	return "account"
}

// Verification represents Better Auth verification tokens
type Verification struct {
	ID         string    `gorm:"primaryKey;type:varchar(64)" json:"id"`
	Identifier string    `gorm:"not null;index;type:varchar(255)" json:"identifier"`
	Value      string    `gorm:"not null;type:text" json:"value"`
	ExpiresAt  time.Time `gorm:"not null" json:"expiresAt"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

func (Verification) TableName() string {
	return "verification"
}

// Room represents classrooms (4.1 through 6.15)
type Room struct {
	ID         string    `gorm:"primaryKey;type:varchar(16)" json:"id"` // e.g. "4.1", "5.14"
	GradeLevel int       `gorm:"not null;index" json:"gradeLevel"`      // 4, 5, 6
	RoomNumber int       `gorm:"not null" json:"roomNumber"`            // 1 - 15
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

func (Room) TableName() string {
	return "rooms"
}

// RoomAdvisor maps 1-3 advisory teachers per room
type RoomAdvisor struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	RoomID       string    `gorm:"not null;index;type:varchar(16)" json:"roomId"`
	Room         Room      `gorm:"foreignKey:RoomID;constraint:OnDelete:CASCADE" json:"room,omitempty"`
	UserID       string    `gorm:"not null;index;type:varchar(64)" json:"userId"`
	User         User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	AdvisorOrder int       `gorm:"not null" json:"advisorOrder"` // 1, 2, 3
	CreatedAt    time.Time `json:"createdAt"`
}

func (RoomAdvisor) TableName() string {
	return "room_advisors"
}

// Student represents student profiles
type Student struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	StudentCode   string    `gorm:"uniqueIndex;type:varchar(32);not null" json:"studentId"` // รหัสนักเรียน เช่น "54321"
	NationalID    string    `gorm:"type:varchar(13);index" json:"nationalId,omitempty"`
	Prefix        string    `gorm:"type:varchar(32)" json:"prefix"` // นาย, นางสาว, เด็กชาย, เด็กหญิง
	FirstName     string    `gorm:"not null;type:varchar(100)" json:"firstName"`
	LastName      string    `gorm:"not null;type:varchar(100)" json:"lastName"`
	RoomID        string    `gorm:"not null;index;type:varchar(16)" json:"roomId"`
	Room          Room      `gorm:"foreignKey:RoomID" json:"room,omitempty"`
	SeatNo        int       `gorm:"not null" json:"seatNo"`
	LanguageGroup string    `gorm:"type:varchar(50)" json:"languageGroup,omitempty"` // เกาหลี, ฝรั่งเศส, ญี่ปุ่น, จีน
	ElectiveGroup string    `gorm:"type:varchar(50)" json:"electiveGroup,omitempty"` // ทัศนศิลป์, ฟุตบอล, ฯลฯ
	Status        string    `gorm:"type:varchar(32);default:'ACTIVE'" json:"status"` // ACTIVE, TRANSFERRED, RESIGNED, SUSPENDED
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

func (Student) TableName() string {
	return "students"
}

// AcademicTerm defines school semester
type AcademicTerm struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Year      int       `gorm:"not null" json:"year"`     // 2568, 2569
	Semester  int       `gorm:"not null" json:"semester"` // 1, 2
	IsActive  bool      `gorm:"default:false" json:"isActive"`
	StartDate time.Time `json:"startDate"`
	EndDate   time.Time `json:"endDate"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (AcademicTerm) TableName() string {
	return "academic_terms"
}

// VerificationMilestone defines 3 verification rounds per term
type VerificationMilestone struct {
	ID               uuid.UUID    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TermID           uuid.UUID    `gorm:"type:uuid;not null;index" json:"termId"`
	Term             AcademicTerm `gorm:"foreignKey:TermID;constraint:OnDelete:CASCADE" json:"term,omitempty"`
	Round            int          `gorm:"not null" json:"round"` // 1:ก่อนกลาง, 2:กลางภาค, 3:หลังกลาง/ปลายภาค
	Title            string       `gorm:"not null;type:varchar(100)" json:"title"`
	TeacherDeadline  time.Time    `json:"teacherDeadline"`
	AcademicDeadline time.Time    `json:"academicDeadline"`
	CreatedAt        time.Time    `json:"createdAt"`
}

func (VerificationMilestone) TableName() string {
	return "verification_milestones"
}

// Course represents subjects taught
type Course struct {
	ID              uuid.UUID    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TermID          uuid.UUID    `gorm:"type:uuid;not null;index" json:"termId"`
	Term            AcademicTerm `gorm:"foreignKey:TermID" json:"term,omitempty"`
	CourseCode      string       `gorm:"not null;index;type:varchar(32)" json:"courseCode"` // เช่น ท32101
	CourseName      string       `gorm:"not null;type:varchar(255)" json:"courseName"`
	Credits              float64      `gorm:"not null" json:"credits"`    // เช่น 1.0, 1.5
	TotalHours           int          `gorm:"not null" json:"totalHours"` // เช่น 40, 60
	AttendanceMaxPeriod1 float64      `gorm:"default:0" json:"attendanceMaxPeriod1"`
	AttendanceMaxPeriod2 float64      `gorm:"default:0" json:"attendanceMaxPeriod2"`
	CourseType      string       `gorm:"type:varchar(32);default:'BASIC'" json:"courseType"` // BASIC, ADDITIONAL
	Department      string       `gorm:"type:varchar(100)" json:"department"`
	Description         string       `gorm:"type:text" json:"description,omitempty"`
	DescriptionFilePath string       `gorm:"type:varchar(500)" json:"descriptionFilePath,omitempty"`
	DescriptionFileType string       `gorm:"type:varchar(50)" json:"descriptionFileType,omitempty"`
	DescriptionFiles    string       `gorm:"type:text" json:"descriptionFiles,omitempty"` // JSON array e.g. [{"url":"...", "type":"image|pdf", "name":"..."}]
	StructureData       string       `gorm:"type:text" json:"structureData,omitempty"`
	StructureFilePath   string       `gorm:"type:varchar(500)" json:"structureFilePath,omitempty"`
	StructureFileType   string       `gorm:"type:varchar(50)" json:"structureFileType,omitempty"`
	StructureFiles      string       `gorm:"type:text" json:"structureFiles,omitempty"` // JSON array e.g. [{"url":"...", "type":"image|pdf", "name":"..."}]
	TargetGroupType     string       `gorm:"type:varchar(32);default:'ALL_ROOMS'" json:"targetGroupType"` // ALL_ROOMS, SPECIFIC_ROOMS, LANGUAGE_GROUP, ELECTIVE_GROUP
	TargetRooms         string       `gorm:"type:text" json:"targetRooms,omitempty"`                     // JSON array of strings: ["4.1", "4.2"]
	TargetSubgroup  string       `gorm:"type:varchar(100)" json:"targetSubgroup,omitempty"`           // เช่น "ญี่ปุ่น" หรือ "ฟุตบอล"
	CreatedByID     string       `gorm:"not null;index;type:varchar(64)" json:"createdById"`
	CreatedBy       User         `gorm:"foreignKey:CreatedByID" json:"createdBy,omitempty"`
	CreatedAt       time.Time    `json:"createdAt"`
	UpdatedAt       time.Time    `json:"updatedAt"`

	Teachers      []CourseTeacher      `gorm:"foreignKey:CourseID" json:"teachers,omitempty"`
	ScoreColumns  []ScoreColumn        `gorm:"foreignKey:CourseID" json:"scoreColumns,omitempty"`
	Enrollments   []CourseEnrollment   `gorm:"foreignKey:CourseID" json:"enrollments,omitempty"`
	Verifications []CourseVerification `gorm:"foreignKey:CourseID" json:"verifications,omitempty"`
}

func (Course) TableName() string {
	return "courses"
}

// CourseTeacher maps primary and co-teachers to courses
type CourseTeacher struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CourseID      uuid.UUID `gorm:"type:uuid;not null;index" json:"courseId"`
	Course        Course    `gorm:"foreignKey:CourseID;constraint:OnDelete:CASCADE" json:"course,omitempty"`
	UserID        string    `gorm:"not null;index;type:varchar(64)" json:"userId"`
	User          User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	IsPrimary     bool      `gorm:"default:false" json:"isPrimary"`
	AssignedRooms string    `gorm:"type:jsonb" json:"assignedRooms,omitempty"` // JSON array e.g. ["4.1", "4.3"]
	CreatedAt     time.Time `json:"createdAt"`
}

func (CourseTeacher) TableName() string {
	return "course_teachers"
}

// CourseEnrollment represents student enrollment in a course
type CourseEnrollment struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CourseID  uuid.UUID `gorm:"type:uuid;not null;index" json:"courseId"`
	Course    Course    `gorm:"foreignKey:CourseID;constraint:OnDelete:CASCADE" json:"course,omitempty"`
	StudentID uuid.UUID `gorm:"type:uuid;not null;index" json:"studentId"`
	Student   Student   `gorm:"foreignKey:StudentID;constraint:OnDelete:CASCADE" json:"student,omitempty"`
	RoomID    string    `gorm:"not null;index;type:varchar(16)" json:"roomId"`
	SeatNo    int       `gorm:"not null" json:"seatNo"`
	Status    string    `gorm:"type:varchar(32);default:'ENROLLED'" json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	Evaluation *StudentEvaluation `gorm:"foreignKey:EnrollmentID" json:"evaluation,omitempty"`
	Scores     []StudentScore     `gorm:"foreignKey:EnrollmentID" json:"scores,omitempty"`
}

func (CourseEnrollment) TableName() string {
	return "course_enrollments"
}

// ScoreColumn defines dynamic score categories per course
type ScoreColumn struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CourseID   uuid.UUID `gorm:"type:uuid;not null;index" json:"courseId"`
	Name       string    `gorm:"not null;type:varchar(100)" json:"name"`
	MaxScore   float64   `gorm:"not null" json:"maxScore"`
	Weight     float64   `gorm:"not null" json:"weight"`
	PeriodType int       `gorm:"not null" json:"periodType"` // 1:ก่อนกลาง, 2:กลางภาค, 3:หลังกลาง, 4:ปลายภาค
	Sequence   int       `gorm:"not null" json:"sequence"`
	CreatedAt  time.Time `json:"createdAt"`
}

func (ScoreColumn) TableName() string {
	return "score_columns"
}

// StudentScore stores individual task/exam score
type StudentScore struct {
	ID            uuid.UUID        `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	EnrollmentID  uuid.UUID        `gorm:"type:uuid;not null;index" json:"enrollmentId"`
	ScoreColumnID uuid.UUID        `gorm:"type:uuid;not null;index" json:"scoreColumnId"`
	ScoreColumn   ScoreColumn      `gorm:"foreignKey:ScoreColumnID;constraint:OnDelete:CASCADE" json:"scoreColumn,omitempty"`
	Score         float64          `gorm:"default:0" json:"score"`
	IsAbsent      bool             `gorm:"default:false" json:"isAbsent"`
	Remarks       string           `gorm:"type:varchar(255)" json:"remarks,omitempty"`
	UpdatedAt     time.Time        `json:"updatedAt"`
}

func (StudentScore) TableName() string {
	return "student_scores"
}

// StudentEvaluation stores consolidated grade, attendance and 3D assessments
type StudentEvaluation struct {
	ID                   uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	EnrollmentID           uuid.UUID `gorm:"type:uuid;uniqueIndex;not null" json:"enrollmentId"`
	AttendanceHoursPeriod1 float64   `gorm:"default:0" json:"attendanceHoursPeriod1"`
	AttendanceHoursPeriod2 float64   `gorm:"default:0" json:"attendanceHoursPeriod2"`
	AttendanceHours        int       `gorm:"default:0" json:"attendanceHours"`
	AttendancePercentage float64   `gorm:"default:100" json:"attendancePercentage"`
	TotalScore           float64   `gorm:"default:0" json:"totalScore"`
	Grade                string    `gorm:"type:varchar(8);default:'0'" json:"grade"` // 0, 1, 1.5, 2, 2.5, 3, 3.5, 4
	SpecialGrade         string    `gorm:"type:varchar(8)" json:"specialGrade,omitempty"` // มส, ร, ผ, มผ
	DesirableSubscores   string    `gorm:"type:jsonb" json:"desirableSubscores,omitempty"`
	DesirableGrade       int       `gorm:"default:3" json:"desirableGrade"` // 0-3
	ReadingSubscores     string    `gorm:"type:jsonb" json:"readingSubscores,omitempty"`
	ReadingGrade         int       `gorm:"default:3" json:"readingGrade"` // 0-3
	CompetencySubscores  string    `gorm:"type:jsonb" json:"competencySubscores,omitempty"`
	CompetencyGrade      int       `gorm:"default:3" json:"competencyGrade"` // 0-3
	IsOverridden         bool      `gorm:"default:false" json:"isOverridden"`
	OverrideReason       string    `gorm:"type:varchar(255)" json:"overrideReason,omitempty"`
	UpdatedAt            time.Time `json:"updatedAt"`
}

func (StudentEvaluation) TableName() string {
	return "student_evaluations"
}

// CourseVerification tracks 3 rounds of verification and approval
type CourseVerification struct {
	ID                 uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CourseID           uuid.UUID  `gorm:"type:uuid;not null;index" json:"courseId"`
	Round              int        `gorm:"not null" json:"round"` // 1, 2, 3
	TeacherSubmitted   bool       `gorm:"default:false" json:"teacherSubmitted"`
	TeacherSubmittedAt *time.Time `json:"teacherSubmittedAt,omitempty"`
	SGSTransferred     bool       `gorm:"default:false" json:"sgsTransferred"`
	DeptHeadStatus     string     `gorm:"type:varchar(32);default:'PENDING'" json:"deptHeadStatus"` // PENDING, APPROVED, REVISE
	DeptHeadComment    string     `gorm:"type:text" json:"deptHeadComment,omitempty"`
	DeptHeadReviewedAt *time.Time `json:"deptHeadReviewedAt,omitempty"`
	AcademicStatus     string     `gorm:"type:varchar(32);default:'PENDING'" json:"academicStatus"` // PENDING, APPROVED, REVISE
	AcademicComment    string     `gorm:"type:text" json:"academicComment,omitempty"`
	AcademicReviewedAt *time.Time `json:"academicReviewedAt,omitempty"`

	// Unlock Request Workflow
	UnlockRequested   bool       `gorm:"default:false" json:"unlockRequested"`
	UnlockReason      string     `gorm:"type:text" json:"unlockReason,omitempty"`
	UnlockRequestedAt *time.Time `json:"unlockRequestedAt,omitempty"`
	UnlockApprovedBy  string     `gorm:"type:varchar(64)" json:"unlockApprovedBy,omitempty"`
	UnlockApprovedAt  *time.Time `json:"unlockApprovedAt,omitempty"`

	UpdatedAt          time.Time  `json:"updatedAt"`
}

func (CourseVerification) TableName() string {
	return "course_verifications"
}

// StudentAuditLog tracks changes in student room/group status
type StudentAuditLog struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	StudentID string    `gorm:"not null;index;type:varchar(32)" json:"studentId"`
	Action    string    `gorm:"not null;type:varchar(64)" json:"action"`
	OldValue  string    `gorm:"type:text" json:"oldValue,omitempty"`
	NewValue  string    `gorm:"type:text" json:"newValue,omitempty"`
	ChangedBy string    `gorm:"not null;type:varchar(64)" json:"changedBy"`
	ChangedAt time.Time `json:"changedAt"`
}

func (StudentAuditLog) TableName() string {
	return "student_audit_logs"
}

// SystemSetting stores system-wide key-value configurations such as assessment criteria
type SystemSetting struct {
	Key         string    `gorm:"primaryKey;type:varchar(64)" json:"key"`
	Value       string    `gorm:"type:text;not null" json:"value"` // JSON string
	Description string    `gorm:"type:varchar(255)" json:"description,omitempty"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (SystemSetting) TableName() string {
	return "system_settings"
}
