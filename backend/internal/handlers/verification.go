package handlers

import (
	"fmt"
	"strings"
	"time"

	"newtea-backend/internal/database"
	"newtea-backend/internal/middleware"
	"newtea-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// EnsureVerificationsExist makes sure 3 verification rounds exist for a course
func EnsureVerificationsExist(tx *gorm.DB, courseID uuid.UUID) ([]models.CourseVerification, error) {
	var verifications []models.CourseVerification
	if err := tx.Where("course_id = ?", courseID).Order("round asc").Find(&verifications).Error; err != nil {
		return nil, err
	}

	existingRounds := make(map[int]bool)
	for _, v := range verifications {
		existingRounds[v.Round] = true
	}

	createdAny := false
	for r := 1; r <= 3; r++ {
		if !existingRounds[r] {
			newVer := models.CourseVerification{
				ID:               uuid.New(),
				CourseID:         courseID,
				Round:            r,
				TeacherSubmitted: false,
				SGSTransferred:   false,
				DeptHeadStatus:   "PENDING",
				AcademicStatus:   "PENDING",
			}
			if err := tx.Create(&newVer).Error; err != nil {
				return nil, err
			}
			createdAny = true
		}
	}

	if createdAny {
		verifications = nil
		if err := tx.Where("course_id = ?", courseID).Order("round asc").Find(&verifications).Error; err != nil {
			return nil, err
		}
	}

	return verifications, nil
}

// GetCourseVerifications returns the 3 verification rounds and associated term milestones
func GetCourseVerifications(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	var course models.Course
	if err := database.DB.Where("id = ?", courseID).First(&course).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Course not found"})
	}

	verifications, err := EnsureVerificationsExist(database.DB, courseID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load verifications: " + err.Error()})
	}

	var milestones []models.VerificationMilestone
	if course.TermID != uuid.Nil {
		database.DB.Where("term_id = ?", course.TermID).Order("round asc").Find(&milestones)
	}

	return c.JSON(fiber.Map{
		"verifications": verifications,
		"milestones":    milestones,
	})
}

type SubmitVerificationInput struct {
	Round int `json:"round"`
}

// SubmitCourseVerification handles teacher submission of a verification round
func SubmitCourseVerification(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	var input SubmitVerificationInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if input.Round < 1 || input.Round > 3 {
		return c.Status(400).JSON(fiber.Map{"error": "Round must be 1, 2, or 3"})
	}

	var course models.Course
	if err := database.DB.Where("id = ?", courseID).First(&course).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Course not found"})
	}

	// Ensure verifications exist
	_, err = EnsureVerificationsExist(database.DB, courseID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to initialize verifications"})
	}

	var ver models.CourseVerification
	if err := database.DB.Where("course_id = ? AND round = ?", courseID, input.Round).First(&ver).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Verification round not found"})
	}

	now := time.Now()
	ver.TeacherSubmitted = true
	ver.TeacherSubmittedAt = &now
	// Reset review statuses when teacher submits/resubmits
	ver.DeptHeadStatus = "PENDING"
	ver.AcademicStatus = "PENDING"

	if err := database.DB.Save(&ver).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to submit verification: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":      fmt.Sprintf("ส่งตรวจคะแนนระยะที่ %d เรียบร้อยแล้ว", input.Round),
		"verification": ver,
	})
}

type ReviewVerificationInput struct {
	Round   int    `json:"round"`
	Status  string `json:"status"` // APPROVED, REVISE
	Comment string `json:"comment"`
}

// ReviewDeptHeadVerification handles approval or return by Department Head
func ReviewDeptHeadVerification(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	var course models.Course
	if err := database.DB.Where("id = ?", courseID).First(&course).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Course not found"})
	}

	// Permission check: ADMIN or DEPT_HEAD of course's department
	isAdmin := strings.EqualFold(user.Role, "ADMIN")
	isDeptHead := strings.EqualFold(user.Role, "DEPT_HEAD") && strings.EqualFold(user.Department, course.Department)
	if !isAdmin && !isDeptHead {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden: ท่านไม่มีสิทธิ์ตรวจรับรองวิชาของกลุ่มสาระฯ นี้"})
	}

	var input ReviewVerificationInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	input.Status = strings.ToUpper(strings.TrimSpace(input.Status))
	if input.Status != "APPROVED" && input.Status != "REVISE" {
		return c.Status(400).JSON(fiber.Map{"error": "Status must be APPROVED or REVISE"})
	}

	var ver models.CourseVerification
	if err := database.DB.Where("course_id = ? AND round = ?", courseID, input.Round).First(&ver).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Verification round not found"})
	}

	now := time.Now()
	ver.DeptHeadStatus = input.Status
	ver.DeptHeadComment = input.Comment
	ver.DeptHeadReviewedAt = &now

	// If returned for revision, mark TeacherSubmitted as false so teacher can modify and resubmit
	if input.Status == "REVISE" {
		ver.TeacherSubmitted = false
	}

	if err := database.DB.Save(&ver).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save verification review: " + err.Error()})
	}

	statusLabel := "รับรองเรียบร้อยแล้ว"
	if input.Status == "REVISE" {
		statusLabel = "ส่งกลับให้แก้ไข"
	}

	return c.JSON(fiber.Map{
		"message":      fmt.Sprintf("หัวหน้ากลุ่มสาระฯ %s ระยะที่ %d", statusLabel, input.Round),
		"verification": ver,
	})
}

// ReviewAcademicVerification handles approval or return by Academic Affairs
func ReviewAcademicVerification(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	var course models.Course
	if err := database.DB.Where("id = ?", courseID).First(&course).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Course not found"})
	}

	// Permission check: ADMIN or ACADEMIC
	isAdmin := strings.EqualFold(user.Role, "ADMIN")
	isAcademic := strings.EqualFold(user.Role, "ACADEMIC")
	if !isAdmin && !isAcademic {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden: เฉพาะฝ่ายวิชาการหรือผู้ดูแลระบบเท่านั้น"})
	}

	var input ReviewVerificationInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	input.Status = strings.ToUpper(strings.TrimSpace(input.Status))
	if input.Status != "APPROVED" && input.Status != "REVISE" {
		return c.Status(400).JSON(fiber.Map{"error": "Status must be APPROVED or REVISE"})
	}

	var ver models.CourseVerification
	if err := database.DB.Where("course_id = ? AND round = ?", courseID, input.Round).First(&ver).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Verification round not found"})
	}

	now := time.Now()
	ver.AcademicStatus = input.Status
	ver.AcademicComment = input.Comment
	ver.AcademicReviewedAt = &now

	// If returned for revision, mark TeacherSubmitted as false so teacher can modify and resubmit
	if input.Status == "REVISE" {
		ver.TeacherSubmitted = false
	}

	if err := database.DB.Save(&ver).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save verification review: " + err.Error()})
	}

	statusLabel := "อนุมัติเรียบร้อยแล้ว"
	if input.Status == "REVISE" {
		statusLabel = "ส่งกลับให้แก้ไข"
	}

	return c.JSON(fiber.Map{
		"message":      fmt.Sprintf("ฝ่ายวิชาการ %s ระยะที่ %d", statusLabel, input.Round),
		"verification": ver,
	})
}

type ToggleSGSInput struct {
	SGSTransferred bool `json:"sgsTransferred"`
}

// ToggleSGSTransferred marks whether grades have been transferred to SGS
func ToggleSGSTransferred(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	isAdmin := strings.EqualFold(user.Role, "ADMIN")
	isAcademic := strings.EqualFold(user.Role, "ACADEMIC")
	if !isAdmin && !isAcademic {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden: เฉพาะฝ่ายวิชาการหรือผู้ดูแลระบบเท่านั้น"})
	}

	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	var input ToggleSGSInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Update round 3 (and any other round) SGS status
	if err := database.DB.Model(&models.CourseVerification{}).
		Where("course_id = ? AND round = 3", courseID).
		Update("sgs_transferred", input.SGSTransferred).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update SGS transfer status: " + err.Error()})
	}

	msg := "บันทึกว่าส่งคะแนนเข้า SGS เรียบร้อยแล้ว"
	if !input.SGSTransferred {
		msg = "ยกเลิกสถานะส่งคะแนนเข้า SGS"
	}

	return c.JSON(fiber.Map{
		"message":        msg,
		"sgsTransferred": input.SGSTransferred,
	})
}

type RequestUnlockInput struct {
	Round  int    `json:"round"`
	Reason string `json:"reason"`
}

// RequestCourseUnlock allows a course teacher to request gradebook unlock
func RequestCourseUnlock(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	var input RequestUnlockInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if input.Round < 1 || input.Round > 3 {
		return c.Status(400).JSON(fiber.Map{"error": "Round must be 1, 2, or 3"})
	}

	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุเหตุผลในการขอปลดล็อกแก้ไขคะแนน"})
	}

	// Verify teacher permission
	isAdmin := strings.EqualFold(user.Role, "ADMIN")
	if !isAdmin {
		var ct models.CourseTeacher
		if err := database.DB.Where("course_id = ? AND user_id = ?", courseID, user.ID).First(&ct).Error; err != nil {
			return c.Status(403).JSON(fiber.Map{"error": "ท่านไม่มีสิทธิ์ขอปลดล็อกคะแนนรายวิชานี้"})
		}
	}

	// Ensure verification exists
	var ver models.CourseVerification
	if err := database.DB.Where("course_id = ? AND round = ?", courseID, input.Round).First(&ver).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Verification round not found"})
	}

	// Check if already unlocked
	if !ver.TeacherSubmitted || ver.DeptHeadStatus == "REVISE" || ver.AcademicStatus == "REVISE" {
		return c.Status(400).JSON(fiber.Map{"error": "ตารางคะแนนในระยะนี้ไม่ได้ถูกล็อกอยู่ ท่านสามารถแก้ไขคะแนนได้ทันที"})
	}

	now := time.Now()
	ver.UnlockRequested = true
	ver.UnlockReason = reason
	ver.UnlockRequestedAt = &now

	if err := database.DB.Save(&ver).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to submit unlock request: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":      fmt.Sprintf("ยื่นคำขอปลดล็อกแก้ไขคะแนนระยะที่ %d เรียบร้อยแล้ว กำลังรอการอนุมัติ", input.Round),
		"verification": ver,
	})
}

type ApproveUnlockInput struct {
	Round int `json:"round"`
}

// ApproveCourseUnlock approves unlock request and unblocks teacher editing
func ApproveCourseUnlock(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	var input ApproveUnlockInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var course models.Course
	if err := database.DB.Where("id = ?", courseID).First(&course).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Course not found"})
	}

	var ver models.CourseVerification
	if err := database.DB.Where("course_id = ? AND round = ?", courseID, input.Round).First(&ver).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Verification round not found"})
	}

	isAdmin := strings.EqualFold(user.Role, "ADMIN")
	isAcademic := strings.EqualFold(user.Role, "ACADEMIC")
	isDeptHead := strings.EqualFold(user.Role, "DEPT_HEAD") && strings.EqualFold(user.Department, course.Department)

	// Special check: If round 3 and already transferred to SGS, only Academic or Admin can approve unlock!
	if input.Round == 3 && ver.SGSTransferred {
		if !isAdmin && !isAcademic {
			return c.Status(403).JSON(fiber.Map{"error": "วิชานี้ส่งคะแนนเข้า SGS แล้ว การปลดล็อกต้องได้รับความเห็นชอบจากฝ่ายวิชาการเท่านั้น"})
		}
	} else {
		if !isAdmin && !isAcademic && !isDeptHead {
			return c.Status(403).JSON(fiber.Map{"error": "ท่านไม่มีสิทธิ์อนุมัติการปลดล็อกรายวิชานี้"})
		}
	}

	now := time.Now()
	ver.TeacherSubmitted = false // Unlocks the gradebook!
	ver.UnlockRequested = false
	ver.DeptHeadStatus = "REVISE"
	ver.UnlockApprovedBy = user.Name
	ver.UnlockApprovedAt = &now

	if err := database.DB.Save(&ver).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to approve unlock: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":      fmt.Sprintf("อนุมัติปลดล็อกระยะที่ %d เรียบร้อยแล้ว ตารางคะแนนเปิดให้ครูแก้ไขได้ทันที", input.Round),
		"verification": ver,
	})
}

type RejectUnlockInput struct {
	Round  int    `json:"round"`
	Reason string `json:"reason"`
}

// RejectCourseUnlock rejects unlock request with reason
func RejectCourseUnlock(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	var input RejectUnlockInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var course models.Course
	if err := database.DB.Where("id = ?", courseID).First(&course).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Course not found"})
	}

	isAdmin := strings.EqualFold(user.Role, "ADMIN")
	isAcademic := strings.EqualFold(user.Role, "ACADEMIC")
	isDeptHead := strings.EqualFold(user.Role, "DEPT_HEAD") && strings.EqualFold(user.Department, course.Department)

	if !isAdmin && !isAcademic && !isDeptHead {
		return c.Status(403).JSON(fiber.Map{"error": "ท่านไม่มีสิทธิ์ปฏิเสธคำขอปลดล็อกนี้"})
	}

	var ver models.CourseVerification
	if err := database.DB.Where("course_id = ? AND round = ?", courseID, input.Round).First(&ver).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Verification round not found"})
	}

	ver.UnlockRequested = false
	if input.Reason != "" {
		ver.DeptHeadComment = "คำขอปลดล็อกถูกปฏิเสธ: " + input.Reason
	}

	if err := database.DB.Save(&ver).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to reject unlock: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":      fmt.Sprintf("ปฏิเสธคำขอปลดล็อกระยะที่ %d เรียบร้อยแล้ว", input.Round),
		"verification": ver,
	})
}

// DeptHeadCourseSummaryDTO holds course verification overview for Dept Head
type DeptHeadCourseSummaryDTO struct {
	Course        models.Course              `json:"course"`
	PrimaryTeacher string                     `json:"primaryTeacher"`
	Rooms         []string                   `json:"rooms"`
	EnrolledCount int                        `json:"enrolledCount"`
	Verifications []models.CourseVerification `json:"verifications"`
}

// GetDeptHeadCourses lists courses in the department of the logged-in Dept Head
func GetDeptHeadCourses(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	isAdmin := strings.EqualFold(user.Role, "ADMIN")
	isDeptHead := strings.EqualFold(user.Role, "DEPT_HEAD")
	if !isAdmin && !isDeptHead {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden: เฉพาะหัวหน้ากลุ่มสาระฯ หรือผู้ดูแลระบบเท่านั้น"})
	}

	termIDQuery := c.Query("termId")
	deptQuery := c.Query("department")

	// If dept head (not admin), force their department
	targetDept := user.Department
	if isAdmin && deptQuery != "" {
		targetDept = deptQuery
	}

	query := database.DB.Model(&models.Course{}).
		Preload("Term").
		Preload("Teachers.User").
		Preload("Verifications", func(db *gorm.DB) *gorm.DB {
			return db.Order("round asc")
		})

	if targetDept != "" {
		query = query.Where("department = ?", targetDept)
	}

	if termIDQuery != "" {
		if termUUID, err := uuid.Parse(termIDQuery); err == nil {
			query = query.Where("term_id = ?", termUUID)
		}
	} else {
		// Default to active term
		var activeTerm models.AcademicTerm
		if err := database.DB.Where("is_active = ?", true).First(&activeTerm).Error; err == nil {
			query = query.Where("term_id = ?", activeTerm.ID)
		}
	}

	var courses []models.Course
	if err := query.Order("course_code asc").Find(&courses).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch courses: " + err.Error()})
	}

	result := make([]DeptHeadCourseSummaryDTO, len(courses))
	for i, course := range courses {
		// Ensure 3 verification rounds exist
		vers, _ := EnsureVerificationsExist(database.DB, course.ID)
		if len(vers) > 0 {
			course.Verifications = vers
		}

		var enrolledCount int64
		database.DB.Model(&models.CourseEnrollment{}).Where("course_id = ?", course.ID).Count(&enrolledCount)

		var rooms []string
		database.DB.Model(&models.CourseEnrollment{}).
			Where("course_id = ?", course.ID).
			Group("room_id").
			Order("SPLIT_PART(room_id, '.', 1)::int asc, SPLIT_PART(room_id, '.', 2)::int asc").
			Pluck("room_id", &rooms)

		primaryTeacherName := ""
		for _, t := range course.Teachers {
			if t.IsPrimary && t.User.Name != "" {
				primaryTeacherName = t.User.Name
				break
			}
		}
		if primaryTeacherName == "" && len(course.Teachers) > 0 && course.Teachers[0].User.Name != "" {
			primaryTeacherName = course.Teachers[0].User.Name
		}

		result[i] = DeptHeadCourseSummaryDTO{
			Course:         course,
			PrimaryTeacher: primaryTeacherName,
			Rooms:          rooms,
			EnrolledCount:  int(enrolledCount),
			Verifications:  course.Verifications,
		}
	}

	return c.JSON(fiber.Map{
		"department": targetDept,
		"total":      len(result),
		"courses":    result,
	})
}

// AcademicOverviewStats holds school-wide counts of verification statuses
type AcademicOverviewStats struct {
	TotalCourses       int `json:"totalCourses"`
	Round1Submitted    int `json:"round1Submitted"`
	Round1Approved     int `json:"round1Approved"`
	Round1Revise       int `json:"round1Revise"`
	Round2Submitted    int `json:"round2Submitted"`
	Round2Approved     int `json:"round2Approved"`
	Round2Revise       int `json:"round2Revise"`
	Round3Submitted    int `json:"round3Submitted"`
	Round3Approved     int `json:"round3Approved"`
	Round3Revise       int `json:"round3Revise"`
	SGSTransferredCount int `json:"sgsTransferredCount"`
	UnlockRequestedCount int `json:"unlockRequestedCount"`
}

// AcademicOverviewCourseDTO represents a row in the TEA68-like Academic Affairs tracking grid
type AcademicOverviewCourseDTO struct {
	ID             uuid.UUID                  `json:"id"`
	CourseCode     string                     `json:"courseCode"`
	CourseName     string                     `json:"courseName"`
	Department     string                     `json:"department"`
	Credits        float64                    `json:"credits"`
	TotalHours     int                        `json:"totalHours"`
	CourseType     string                     `json:"courseType"`
	PrimaryTeacher string                     `json:"primaryTeacher"`
	Teachers       []string                   `json:"teachers"`
	Rooms          []string                   `json:"rooms"`
	EnrolledCount  int                        `json:"enrolledCount"`
	Verifications  []models.CourseVerification `json:"verifications"`
}

// GetAcademicOverview returns complete verification tracking grid for Academic Affairs
func GetAcademicOverview(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	isAdmin := strings.EqualFold(user.Role, "ADMIN")
	isAcademic := strings.EqualFold(user.Role, "ACADEMIC")
	if !isAdmin && !isAcademic {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden: เฉพาะฝ่ายวิชาการหรือผู้ดูแลระบบเท่านั้น"})
	}

	termIDQuery := c.Query("termId")
	deptQuery := c.Query("department")
	gradeQuery := c.Query("gradeLevel") // 4, 5, 6
	statusQuery := c.Query("status")     // PENDING, APPROVED, REVISE, SUBMITTED

	// Determine term
	var targetTerm models.AcademicTerm
	if termIDQuery != "" {
		if termUUID, err := uuid.Parse(termIDQuery); err == nil {
			database.DB.Where("id = ?", termUUID).First(&targetTerm)
		}
	}
	if targetTerm.ID == uuid.Nil {
		database.DB.Where("is_active = ?", true).First(&targetTerm)
	}

	query := database.DB.Model(&models.Course{}).
		Preload("Term").
		Preload("Teachers.User").
		Preload("Verifications", func(db *gorm.DB) *gorm.DB {
			return db.Order("round asc")
		})

	if targetTerm.ID != uuid.Nil {
		query = query.Where("term_id = ?", targetTerm.ID)
	}

	if deptQuery != "" && deptQuery != "ALL" {
		query = query.Where("department = ?", deptQuery)
	}

	var courses []models.Course
	if err := query.Order("course_code asc").Find(&courses).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch courses: " + err.Error()})
	}

	var rows []AcademicOverviewCourseDTO
	stats := AcademicOverviewStats{
		TotalCourses: len(courses),
	}

	for _, course := range courses {
		vers, _ := EnsureVerificationsExist(database.DB, course.ID)
		if len(vers) > 0 {
			course.Verifications = vers
		}

		var enrolledCount int64
		database.DB.Model(&models.CourseEnrollment{}).Where("course_id = ?", course.ID).Count(&enrolledCount)

		var rooms []string
		database.DB.Model(&models.CourseEnrollment{}).
			Where("course_id = ?", course.ID).
			Group("room_id").
			Order("SPLIT_PART(room_id, '.', 1)::int asc, SPLIT_PART(room_id, '.', 2)::int asc").
			Pluck("room_id", &rooms)

		// Filter by grade level if specified
		if gradeQuery != "" && gradeQuery != "ALL" {
			matchedGrade := false
			for _, r := range rooms {
				if strings.HasPrefix(r, gradeQuery+".") {
					matchedGrade = true
					break
				}
			}
			if !matchedGrade {
				continue
			}
		}

		primaryTeacherName := ""
		teacherNames := []string{}
		for _, t := range course.Teachers {
			if t.User.Name != "" {
				teacherNames = append(teacherNames, t.User.Name)
				if t.IsPrimary && primaryTeacherName == "" {
					primaryTeacherName = t.User.Name
				}
			}
		}
		if primaryTeacherName == "" && len(teacherNames) > 0 {
			primaryTeacherName = teacherNames[0]
		}

		// Calculate stats for this course
		for _, v := range course.Verifications {
			if v.UnlockRequested {
				stats.UnlockRequestedCount++
			}
			switch v.Round {
			case 1:
				if v.TeacherSubmitted {
					stats.Round1Submitted++
				}
				if v.AcademicStatus == "APPROVED" {
					stats.Round1Approved++
				}
				if v.AcademicStatus == "REVISE" || v.DeptHeadStatus == "REVISE" {
					stats.Round1Revise++
				}
			case 2:
				if v.TeacherSubmitted {
					stats.Round2Submitted++
				}
				if v.AcademicStatus == "APPROVED" {
					stats.Round2Approved++
				}
				if v.AcademicStatus == "REVISE" || v.DeptHeadStatus == "REVISE" {
					stats.Round2Revise++
				}
			case 3:
				if v.TeacherSubmitted {
					stats.Round3Submitted++
				}
				if v.AcademicStatus == "APPROVED" {
					stats.Round3Approved++
				}
				if v.AcademicStatus == "REVISE" || v.DeptHeadStatus == "REVISE" {
					stats.Round3Revise++
				}
				if v.SGSTransferred {
					stats.SGSTransferredCount++
				}
			}
		}

		// Filter by status if specified
		if statusQuery != "" && statusQuery != "ALL" {
			hasMatchingStatus := false
			for _, v := range course.Verifications {
				if statusQuery == "UNLOCK_REQUEST" && v.UnlockRequested {
					hasMatchingStatus = true
					break
				}
				if statusQuery == "SUBMITTED" && v.TeacherSubmitted {
					hasMatchingStatus = true
					break
				}
				if statusQuery == "APPROVED" && (v.AcademicStatus == "APPROVED" || v.DeptHeadStatus == "APPROVED") {
					hasMatchingStatus = true
					break
				}
				if statusQuery == "REVISE" && (v.AcademicStatus == "REVISE" || v.DeptHeadStatus == "REVISE") {
					hasMatchingStatus = true
					break
				}
				if statusQuery == "PENDING" && !v.TeacherSubmitted {
					hasMatchingStatus = true
					break
				}
				if statusQuery == "SGS" && v.SGSTransferred {
					hasMatchingStatus = true
					break
				}
			}
			if !hasMatchingStatus {
				continue
			}
		}

		rows = append(rows, AcademicOverviewCourseDTO{
			ID:             course.ID,
			CourseCode:     course.CourseCode,
			CourseName:     course.CourseName,
			Department:     course.Department,
			Credits:        course.Credits,
			TotalHours:     course.TotalHours,
			CourseType:     course.CourseType,
			PrimaryTeacher: primaryTeacherName,
			Teachers:       teacherNames,
			Rooms:          rooms,
			EnrolledCount:  int(enrolledCount),
			Verifications:  course.Verifications,
		})
	}

	return c.JSON(fiber.Map{
		"term":    targetTerm,
		"total":   len(rows),
		"courses": rows,
		"stats":   stats,
	})
}
