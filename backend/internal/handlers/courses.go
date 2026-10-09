package handlers

import (
	"encoding/json"
	"fmt"
	"mime/multipart"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"newtea-backend/internal/database"
	"newtea-backend/internal/middleware"
	"newtea-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CourseTeacherInput represents teacher assignment input
type CourseTeacherInput struct {
	UserID            string   `json:"userId"`
	IsPrimary         bool     `json:"isPrimary"`
	AssignedRooms     []string `json:"assignedRooms"`
	AutoAdjustPrimary bool     `json:"autoAdjustPrimary"`
}

// CreateCourseInput defines payload for creating a new course
type CreateCourseInput struct {
	TermID          string               `json:"termId"`
	CourseCode      string               `json:"courseCode"`
	CourseName      string               `json:"courseName"`
	Credits         float64              `json:"credits"`
	TotalHours      int                  `json:"totalHours"`
	CourseType      string               `json:"courseType"` // BASIC, ADDITIONAL
	Department      string               `json:"department"`
	Description     string               `json:"description"`
	TargetGroupType string               `json:"targetGroupType"` // ALL_ROOMS, SPECIFIC_ROOMS, LANGUAGE_GROUP, ELECTIVE_GROUP
	TargetRooms     []string             `json:"targetRooms"`
	TargetSubgroup  string               `json:"targetSubgroup"` // e.g. "ญี่ปุ่น" or "ทัศนศิลป์"
	Teachers        []CourseTeacherInput `json:"teachers"`
}

// GetCourses lists courses with filter options
func GetCourses(c *fiber.Ctx) error {
	termID := c.Query("term_id")
	department := c.Query("department")
	teacherID := c.Query("teacher_id")
	search := strings.TrimSpace(c.Query("search"))
	scope := strings.ToLower(strings.TrimSpace(c.Query("scope")))

	currentUser := middleware.GetCurrentUser(c)

	var resolvedTermID uuid.UUID
	if termID != "" {
		if tUUID, err := uuid.Parse(termID); err == nil {
			resolvedTermID = tUUID
		}
	} else {
		// Default to active term if no term specified
		var activeTerm models.AcademicTerm
		if err := database.DB.Where("is_active = ?", true).First(&activeTerm).Error; err == nil {
			resolvedTermID = activeTerm.ID
		}
	}

	query := database.DB.Model(&models.Course{}).
		Preload("Term").
		Preload("Teachers.User").
		Preload("ScoreColumns", func(db *gorm.DB) *gorm.DB {
			return db.Order("sequence asc")
		}).
		Preload("Verifications", func(db *gorm.DB) *gorm.DB {
			return db.Order("round asc")
		})

	if resolvedTermID != uuid.Nil {
		query = query.Where("term_id = ?", resolvedTermID)
	}

	if department != "" {
		query = query.Where("department = ?", department)
	}

	if teacherID != "" {
		query = query.Joins("JOIN course_teachers ON course_teachers.course_id = courses.id").
			Where("course_teachers.user_id = ?", teacherID)
	}

	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("course_code ILIKE ? OR course_name ILIKE ?", searchPattern, searchPattern)
	}

	// Scoping logic:
	// - scope == "my": filter to only courses created by or taught by current user
	// - scope == "": if user is TEACHER/DEPT_HEAD/ADVISOR, default to "my"
	// - scope == "all": return all school courses
	shouldFilterMyCourses := false
	if scope == "my" {
		shouldFilterMyCourses = true
	} else if scope == "" && currentUser != nil && currentUser.Role != "ADMIN" && currentUser.Role != "ACADEMIC" {
		shouldFilterMyCourses = true
	}

	if shouldFilterMyCourses {
		if currentUser != nil {
			query = query.Where(
				"courses.created_by_id = ? OR courses.id IN (SELECT course_id FROM course_teachers WHERE user_id = ?)",
				currentUser.ID, currentUser.ID,
			)
		} else {
			// Unauthenticated requesting "my" courses gets empty result
			query = query.Where("1 = 0")
		}
	}

	var courses []models.Course
	if err := query.Order("course_code asc").Find(&courses).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch courses: " + err.Error()})
	}

	// Calculate counts for badges
	var myCount int64 = 0
	var allCount int64 = 0
	if resolvedTermID != uuid.Nil {
		database.DB.Model(&models.Course{}).Where("term_id = ?", resolvedTermID).Count(&allCount)
		if currentUser != nil {
			database.DB.Model(&models.Course{}).
				Where("term_id = ? AND (created_by_id = ? OR id IN (SELECT course_id FROM course_teachers WHERE user_id = ?))",
					resolvedTermID, currentUser.ID, currentUser.ID).
				Count(&myCount)
		}
	}

	// Prepare summary list with student counts and ownership flags
	type CourseSummaryDTO struct {
		models.Course
		EnrolledCount int      `json:"enrolledCount"`
		Rooms         []string `json:"rooms"`
		IsOwner       bool     `json:"isOwner"`
		IsTeacher     bool     `json:"isTeacher"`
		CanEdit       bool     `json:"canEdit"`
	}

	summaries := make([]CourseSummaryDTO, len(courses))
	for i, course := range courses {
		var enrolledCount int64
		database.DB.Model(&models.CourseEnrollment{}).Where("course_id = ?", course.ID).Count(&enrolledCount)

		var rooms []string
		database.DB.Model(&models.CourseEnrollment{}).
			Where("course_id = ?", course.ID).
			Group("room_id").
			Order("SPLIT_PART(room_id, '.', 1)::int asc, SPLIT_PART(room_id, '.', 2)::int asc").
			Pluck("room_id", &rooms)

		if len(rooms) == 0 && course.TargetRooms != "" {
			_ = json.Unmarshal([]byte(course.TargetRooms), &rooms)
		}

		// Calculate user permissions for this course
		isOwner := false
		isTeacher := false
		if currentUser != nil {
			if strings.EqualFold(currentUser.Role, "ADMIN") || currentUser.ID == course.CreatedByID {
				isOwner = true
			}
			for _, t := range course.Teachers {
				if t.UserID == currentUser.ID {
					isTeacher = true
					break
				}
			}
			if isOwner {
				isTeacher = true
			}
		}

		canEdit := isOwner || isTeacher || (currentUser != nil && (strings.EqualFold(currentUser.Role, "ADMIN") || strings.EqualFold(currentUser.Role, "ACADEMIC")))

		summaries[i] = CourseSummaryDTO{
			Course:        course,
			EnrolledCount: int(enrolledCount),
			Rooms:         rooms,
			IsOwner:       isOwner,
			IsTeacher:     isTeacher,
			CanEdit:       canEdit,
		}
	}

	return c.JSON(fiber.Map{
		"total":    len(summaries),
		"courses":  summaries,
		"myCount":  myCount,
		"allCount": allCount,
	})
}

// GetCourseByID retrieves course details
func GetCourseByID(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	// Ensure 3 verification rounds exist
	_, _ = EnsureVerificationsExist(database.DB, courseID)

	var course models.Course
	err = database.DB.
		Preload("Term").
		Preload("Teachers.User").
		Preload("ScoreColumns", func(db *gorm.DB) *gorm.DB {
			return db.Order("sequence asc")
		}).
		Preload("Verifications", func(db *gorm.DB) *gorm.DB {
			return db.Order("round asc")
		}).
		Where("id = ?", courseID).
		First(&course).Error

	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Course not found"})
	}

	var enrolledCount int64
	database.DB.Model(&models.CourseEnrollment{}).Where("course_id = ?", course.ID).Count(&enrolledCount)

	var rooms []string
	database.DB.Model(&models.CourseEnrollment{}).
		Where("course_id = ?", course.ID).
		Group("room_id").
		Order("SPLIT_PART(room_id, '.', 1)::int asc, SPLIT_PART(room_id, '.', 2)::int asc").
		Pluck("room_id", &rooms)

	if len(rooms) == 0 && course.TargetRooms != "" {
		_ = json.Unmarshal([]byte(course.TargetRooms), &rooms)
	}

	return c.JSON(fiber.Map{
		"course":        course,
		"enrolledCount": enrolledCount,
		"rooms":         rooms,
	})
}

// CreateCourse creates a course, auto-enrolls students, sets up default score columns and 3D milestones
func CreateCourse(c *fiber.Ctx) error {
	var input CreateCourseInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body: " + err.Error()})
	}

	input.CourseCode = strings.TrimSpace(input.CourseCode)
	input.CourseName = strings.TrimSpace(input.CourseName)
	if input.CourseCode == "" || input.CourseName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "รหัสวิชาและชื่อวิชาจำเป็นต้องระบุ"})
	}

	// 1. Resolve Term
	var termID uuid.UUID
	if input.TermID != "" {
		if tUUID, err := uuid.Parse(input.TermID); err == nil {
			termID = tUUID
		}
	}
	if termID == uuid.Nil {
		var activeTerm models.AcademicTerm
		if err := database.DB.Where("is_active = ?", true).First(&activeTerm).Error; err == nil {
			termID = activeTerm.ID
		} else {
			// Find any term
			var anyTerm models.AcademicTerm
			if err := database.DB.Order("year desc, semester desc").First(&anyTerm).Error; err == nil {
				termID = anyTerm.ID
			} else {
				return c.Status(400).JSON(fiber.Map{"error": "ไม่พบข้อมูลปีการศึกษาในระบบ กรุณาสร้างปีการศึกษาก่อน"})
			}
		}
	}

	// 2. Resolve Creator User
	currentUser := middleware.GetCurrentUser(c)
	creatorID := ""
	if currentUser != nil {
		creatorID = currentUser.ID
	} else {
		// Fallback: pick any user or admin
		var user models.User
		if err := database.DB.First(&user).Error; err == nil {
			creatorID = user.ID
		} else {
			return c.Status(500).JSON(fiber.Map{"error": "No user found in database to assign as course creator"})
		}
	}

	if input.Credits <= 0 {
		input.Credits = 1.0
	}
	if input.TotalHours <= 0 {
		input.TotalHours = int(input.Credits * 40)
	}
	if input.CourseType == "" {
		input.CourseType = "BASIC"
	}
	if input.TargetGroupType == "" {
		input.TargetGroupType = "ALL_ROOMS"
	}

	// Target Rooms JSON
	targetRoomsJSON, _ := json.Marshal(input.TargetRooms)

	tx := database.DB.Begin()

	// 3. Create Course
	course := models.Course{
		ID:              uuid.New(),
		TermID:          termID,
		CourseCode:      input.CourseCode,
		CourseName:      input.CourseName,
		Credits:         input.Credits,
		TotalHours:      input.TotalHours,
		CourseType:      input.CourseType,
		Department:      input.Department,
		Description:      input.Description,
		DescriptionFiles: "[]",
		StructureData:    "",
		StructureFiles:   "[]",
		TargetGroupType:  input.TargetGroupType,
		TargetRooms:     string(targetRoomsJSON),
		TargetSubgroup:  input.TargetSubgroup,
		CreatedByID:     creatorID,
	}

	if err := tx.Create(&course).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create course: " + err.Error()})
	}

	// 4. Create Course Teachers
	if len(input.Teachers) > 0 {
		for _, tInput := range input.Teachers {
			assignedRoomsJSON, _ := json.Marshal(tInput.AssignedRooms)
			ct := models.CourseTeacher{
				ID:            uuid.New(),
				CourseID:      course.ID,
				UserID:        tInput.UserID,
				IsPrimary:     tInput.IsPrimary,
				AssignedRooms: string(assignedRoomsJSON),
			}
			if err := tx.Create(&ct).Error; err != nil {
				tx.Rollback()
				return c.Status(500).JSON(fiber.Map{"error": "Failed to assign teacher: " + err.Error()})
			}
		}
	} else {
		// Assign creator as primary teacher
		ct := models.CourseTeacher{
			ID:            uuid.New(),
			CourseID:      course.ID,
			UserID:        creatorID,
			IsPrimary:     true,
			AssignedRooms: "[]",
		}
		if err := tx.Create(&ct).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Failed to assign primary teacher: " + err.Error()})
		}
	}

	// 5. Query matching active students for Auto-Enrollment
	studentQuery := tx.Model(&models.Student{}).Where("status = ?", "ACTIVE")

	if len(input.TargetRooms) > 0 {
		studentQuery = studentQuery.Where("room_id IN (?)", input.TargetRooms)
	}

	switch input.TargetGroupType {
	case "LANGUAGE_GROUP":
		if input.TargetSubgroup != "" {
			studentQuery = studentQuery.Where("language_group = ?", input.TargetSubgroup)
		}
	case "ELECTIVE_GROUP":
		if input.TargetSubgroup != "" {
			studentQuery = studentQuery.Where("elective_group = ?", input.TargetSubgroup)
		}
	}

	var matchedStudents []models.Student
	if err := studentQuery.Order("SPLIT_PART(room_id, '.', 1)::int asc, SPLIT_PART(room_id, '.', 2)::int asc, seat_no asc").Find(&matchedStudents).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find matching students: " + err.Error()})
	}

	// 6. Create Enrollments and Initial Evaluations
	for _, s := range matchedStudents {
		enrollment := models.CourseEnrollment{
			ID:        uuid.New(),
			CourseID:  course.ID,
			StudentID: s.ID,
			RoomID:    s.RoomID,
			SeatNo:    s.SeatNo,
			Status:    "ENROLLED",
		}
		if err := tx.Create(&enrollment).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Failed to enroll student: " + err.Error()})
		}

		evaluation := models.StudentEvaluation{
			ID:                   uuid.New(),
			EnrollmentID:         enrollment.ID,
			AttendanceHours:      course.TotalHours,
			AttendancePercentage: 100.0,
			TotalScore:           0.0,
			Grade:                "0",
			DesirableSubscores:   "[]",
			DesirableGrade:       3,
			ReadingSubscores:     "[]",
			ReadingGrade:         3,
			CompetencySubscores:  "[]",
			CompetencyGrade:      3,
			IsOverridden:         false,
		}
		if err := tx.Create(&evaluation).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Failed to initialize student evaluation: " + err.Error()})
		}
	}

	// 7. Create Standard Default Score Columns (Total Weight = 100: 10+10+10 / 20 / 10+10+10 / 20)
	defaultColumns := GetDefaultScoreColumns(course.ID)
	for _, col := range defaultColumns {
		if err := tx.Create(&col).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create score columns: " + err.Error()})
		}
	}

	// 8. Create Course Verification 3 Rounds
	for round := 1; round <= 3; round++ {
		ver := models.CourseVerification{
			ID:               uuid.New(),
			CourseID:         course.ID,
			Round:            round,
			TeacherSubmitted: false,
			SGSTransferred:   false,
			DeptHeadStatus:   "PENDING",
			AcademicStatus:   "PENDING",
		}
		if err := tx.Create(&ver).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create verification round: " + err.Error()})
		}
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Transaction commit failed: " + err.Error()})
	}

	// Preload and return course
	var result models.Course
	database.DB.
		Preload("Term").
		Preload("Teachers.User").
		Preload("ScoreColumns", func(db *gorm.DB) *gorm.DB {
			return db.Order("sequence asc")
		}).
		First(&result, course.ID)

	return c.Status(201).JSON(fiber.Map{
		"message":       fmt.Sprintf("สร้างรายวิชา %s สำเร็จ และดึงนักเรียนเข้าห้องเรียนจำนวน %d คน", course.CourseCode, len(matchedStudents)),
		"course":        result,
		"enrolledCount": len(matchedStudents),
	})
}

// UpdateCourse updates course metadata
func UpdateCourse(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	var course models.Course
	if err := database.DB.First(&course, courseID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Course not found"})
	}

	type UpdateCourseInput struct {
		CourseCode           string   `json:"courseCode"`
		CourseName           string   `json:"courseName"`
		Credits              float64  `json:"credits"`
		TotalHours           int      `json:"totalHours"`
		CourseType           string   `json:"courseType"`
		Department           string   `json:"department"`
		Description          *string  `json:"description"`
		StructureData        *string  `json:"structureData"`
		AttendanceMaxPeriod1 *float64 `json:"attendanceMaxPeriod1"`
		AttendanceMaxPeriod2 *float64 `json:"attendanceMaxPeriod2"`
	}

	var input UpdateCourseInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if input.CourseCode != "" {
		course.CourseCode = strings.TrimSpace(input.CourseCode)
	}
	if input.CourseName != "" {
		course.CourseName = strings.TrimSpace(input.CourseName)
	}
	if input.Credits > 0 {
		course.Credits = input.Credits
	}
	if input.TotalHours > 0 {
		course.TotalHours = input.TotalHours
	}
	if input.CourseType != "" {
		course.CourseType = input.CourseType
	}
	if input.Department != "" {
		course.Department = input.Department
	}
	if input.Description != nil {
		course.Description = strings.TrimSpace(*input.Description)
	}
	if input.StructureData != nil {
		course.StructureData = strings.TrimSpace(*input.StructureData)
	}
	if input.AttendanceMaxPeriod1 != nil && *input.AttendanceMaxPeriod1 >= 0 {
		course.AttendanceMaxPeriod1 = *input.AttendanceMaxPeriod1
	}
	if input.AttendanceMaxPeriod2 != nil && *input.AttendanceMaxPeriod2 >= 0 {
		course.AttendanceMaxPeriod2 = *input.AttendanceMaxPeriod2
	}

	if course.TargetRooms == "" {
		course.TargetRooms = "[]"
	}
	if course.DescriptionFiles == "" {
		course.DescriptionFiles = "[]"
	}
	if course.StructureFiles == "" {
		course.StructureFiles = "[]"
	}

	if err := database.DB.Save(&course).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update course: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "แก้ไขข้อมูลรายวิชาสำเร็จ",
		"course":  course,
	})
}

// DeleteCourse deletes a course and all related data
func DeleteCourse(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	var course models.Course
	if err := database.DB.First(&course, courseID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Course not found"})
	}

	// Cascade delete course (Enrollments, Scores, Evaluations, Columns, Teachers, Verifications)
	tx := database.DB.Begin()

	// 1. Delete student scores & evaluations
	tx.Exec("DELETE FROM student_scores WHERE enrollment_id IN (SELECT id FROM course_enrollments WHERE course_id = ?)", courseID)
	tx.Exec("DELETE FROM student_evaluations WHERE enrollment_id IN (SELECT id FROM course_enrollments WHERE course_id = ?)", courseID)
	tx.Exec("DELETE FROM course_enrollments WHERE course_id = ?", courseID)
	tx.Exec("DELETE FROM score_columns WHERE course_id = ?", courseID)
	tx.Exec("DELETE FROM course_teachers WHERE course_id = ?", courseID)
	tx.Exec("DELETE FROM course_verifications WHERE course_id = ?", courseID)

	if err := tx.Delete(&course).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete course: " + err.Error()})
	}

	tx.Commit()

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("ลบรายวิชา %s เรียบร้อยแล้ว", course.CourseCode),
	})
}

// AddCoTeacher adds a co-teacher to a course
func AddCoTeacher(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	var input CourseTeacherInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if input.UserID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "UserID is required"})
	}

	var user models.User
	if err := database.DB.Where("id = ?", input.UserID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Teacher user not found"})
	}

	// Check if already assigned
	var existing models.CourseTeacher
	if err := database.DB.Where("course_id = ? AND user_id = ?", courseID, input.UserID).First(&existing).Error; err == nil {
		// Update rooms
		assignedRoomsJSON, _ := json.Marshal(input.AssignedRooms)
		existing.AssignedRooms = string(assignedRoomsJSON)
		if input.IsPrimary {
			existing.IsPrimary = true
		}
		database.DB.Save(&existing)

		if input.AutoAdjustPrimary && !existing.IsPrimary {
			adjustPrimaryTeacherRooms(courseID)
		}

		database.DB.Preload("User").First(&existing, existing.ID)
		return c.JSON(fiber.Map{
			"message": "อัปเดตข้อมูลครูร่วมสอนสำเร็จ",
			"teacher": existing,
		})
	}

	assignedRoomsJSON, _ := json.Marshal(input.AssignedRooms)
	ct := models.CourseTeacher{
		ID:            uuid.New(),
		CourseID:      courseID,
		UserID:        input.UserID,
		IsPrimary:     input.IsPrimary,
		AssignedRooms: string(assignedRoomsJSON),
	}

	if err := database.DB.Create(&ct).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to assign teacher: " + err.Error()})
	}

	if input.AutoAdjustPrimary && !input.IsPrimary {
		adjustPrimaryTeacherRooms(courseID)
	}

	database.DB.Preload("User").First(&ct, ct.ID)

	return c.Status(201).JSON(fiber.Map{
		"message": fmt.Sprintf("เพิ่มครูร่วมสอน %s สำเร็จ", user.Name),
		"teacher": ct,
	})
}

// adjustPrimaryTeacherRooms calculates and assigns remaining rooms to the primary teacher
func adjustPrimaryTeacherRooms(courseID uuid.UUID) {
	// 1. Fetch all distinct rooms in course
	var allRooms []string
	database.DB.Model(&models.CourseEnrollment{}).
		Where("course_id = ?", courseID).
		Group("room_id").
		Order("SPLIT_PART(room_id, '.', 1)::int asc, SPLIT_PART(room_id, '.', 2)::int asc").
		Pluck("room_id", &allRooms)

	// Fallback to course TargetRooms if no enrollments yet
	if len(allRooms) == 0 {
		var course models.Course
		if err := database.DB.First(&course, courseID).Error; err == nil && course.TargetRooms != "" {
			_ = json.Unmarshal([]byte(course.TargetRooms), &allRooms)
		}
	}

	// 2. Fetch all co-teachers' assigned rooms
	var coTeachers []models.CourseTeacher
	database.DB.Where("course_id = ? AND is_primary = false", courseID).Find(&coTeachers)

	takenRoomsMap := make(map[string]bool)
	hasSpecificCoRooms := false
	for _, ct := range coTeachers {
		var rooms []string
		if err := json.Unmarshal([]byte(ct.AssignedRooms), &rooms); err == nil && len(rooms) > 0 {
			hasSpecificCoRooms = true
			for _, r := range rooms {
				takenRoomsMap[r] = true
			}
		}
	}

	// 3. Compute remaining rooms
	var remainingRooms []string
	if hasSpecificCoRooms {
		for _, r := range allRooms {
			if !takenRoomsMap[r] {
				remainingRooms = append(remainingRooms, r)
			}
		}
	} else {
		remainingRooms = allRooms
	}

	// 4. Update primary teacher
	var primary models.CourseTeacher
	if err := database.DB.Where("course_id = ? AND is_primary = true", courseID).First(&primary).Error; err == nil {
		remJSON, _ := json.Marshal(remainingRooms)
		primary.AssignedRooms = string(remJSON)
		database.DB.Save(&primary)
	}
}

// UpdateCourseTeacherRooms updates rooms assigned to a specific course teacher
func UpdateCourseTeacherRooms(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	teacherID := c.Params("teacherId")
	ctID, err := uuid.Parse(teacherID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid teacher assignment id"})
	}

	var input struct {
		AssignedRooms []string `json:"assignedRooms"`
		IsPrimary     *bool    `json:"isPrimary,omitempty"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var ct models.CourseTeacher
	if err := database.DB.Where("id = ? AND course_id = ?", ctID, courseID).First(&ct).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Teacher assignment not found"})
	}

	assignedRoomsJSON, _ := json.Marshal(input.AssignedRooms)
	ct.AssignedRooms = string(assignedRoomsJSON)
	if input.IsPrimary != nil {
		ct.IsPrimary = *input.IsPrimary
	}

	if err := database.DB.Save(&ct).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update teacher rooms: " + err.Error()})
	}

	database.DB.Preload("User").First(&ct, ct.ID)

	return c.JSON(fiber.Map{
		"message": "อัปเดตห้องที่รับผิดชอบสำเร็จ",
		"teacher": ct,
	})
}

// RemoveCoTeacher removes a teacher from a course
func RemoveCoTeacher(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	teacherID := c.Params("teacherId")
	ctID, err := uuid.Parse(teacherID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid teacher assignment id"})
	}

	var ct models.CourseTeacher
	if err := database.DB.Where("id = ? AND course_id = ?", ctID, courseID).First(&ct).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Teacher assignment not found"})
	}

	if ct.IsPrimary {
		// Check if there are other teachers to promote or prevent deleting primary
		var count int64
		database.DB.Model(&models.CourseTeacher{}).Where("course_id = ?", courseID).Count(&count)
		if count <= 1 {
			return c.Status(400).JSON(fiber.Map{"error": "ไม่สามารถลบครูผู้สอนหลักได้ เนื่องจากมีครูผู้สอนเพียงคนเดียว"})
		}
	}

	if err := database.DB.Delete(&ct).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to remove teacher: " + err.Error()})
	}

	adjustPrimaryTeacherRooms(courseID)

	return c.JSON(fiber.Map{
		"message": "ถอนครูร่วมสอนออกจากรายวิชาเรียบร้อยแล้ว",
	})
}

// GetDefaultScoreColumns returns standard 8 score columns:
// ก่อนกลางภาค 10+10+10, กลางภาค 20, หลังกลางภาค 10+10+10, ปลายภาค 20
func GetDefaultScoreColumns(courseID uuid.UUID) []models.ScoreColumn {
	return []models.ScoreColumn{
		{
			ID:         uuid.New(),
			CourseID:   courseID,
			Name:       "ก่อนกลางภาค 1",
			MaxScore:   10.0,
			Weight:     10.0,
			PeriodType: 1, // ก่อนกลางภาค
			Sequence:   1,
		},
		{
			ID:         uuid.New(),
			CourseID:   courseID,
			Name:       "ก่อนกลางภาค 2",
			MaxScore:   10.0,
			Weight:     10.0,
			PeriodType: 1,
			Sequence:   2,
		},
		{
			ID:         uuid.New(),
			CourseID:   courseID,
			Name:       "ก่อนกลางภาค 3",
			MaxScore:   10.0,
			Weight:     10.0,
			PeriodType: 1,
			Sequence:   3,
		},
		{
			ID:         uuid.New(),
			CourseID:   courseID,
			Name:       "สอบกลางภาค",
			MaxScore:   20.0,
			Weight:     20.0,
			PeriodType: 2, // กลางภาค
			Sequence:   4,
		},
		{
			ID:         uuid.New(),
			CourseID:   courseID,
			Name:       "หลังกลางภาค 1",
			MaxScore:   10.0,
			Weight:     10.0,
			PeriodType: 3, // หลังกลางภาค
			Sequence:   5,
		},
		{
			ID:         uuid.New(),
			CourseID:   courseID,
			Name:       "หลังกลางภาค 2",
			MaxScore:   10.0,
			Weight:     10.0,
			PeriodType: 3,
			Sequence:   6,
		},
		{
			ID:         uuid.New(),
			CourseID:   courseID,
			Name:       "หลังกลางภาค 3",
			MaxScore:   10.0,
			Weight:     10.0,
			PeriodType: 3,
			Sequence:   7,
		},
		{
			ID:         uuid.New(),
			CourseID:   courseID,
			Name:       "สอบปลายภาค",
			MaxScore:   20.0,
			Weight:     20.0,
			PeriodType: 4, // ปลายภาค
			Sequence:   8,
		},
	}
}

// CourseAttachmentItem represents a single attached file
type CourseAttachmentItem struct {
	URL  string `json:"url"`
	Type string `json:"type"` // "pdf" or "image"
	Name string `json:"name"`
}

// UploadCourseAttachment handles uploading PDF/image attachments for description or structure
func UploadCourseAttachment(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course ID"})
	}

	var course models.Course
	if err := database.DB.First(&course, courseID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Course not found"})
	}

	attachType := strings.ToLower(strings.TrimSpace(c.FormValue("type"))) // "description" or "structure"
	if attachType != "description" && attachType != "structure" {
		return c.Status(400).JSON(fiber.Map{"error": "Type must be either 'description' or 'structure'"})
	}

	// Prepare directory: uploads/courses/<courseID>
	courseDir := filepath.Join("uploads", "courses", courseID.String())
	if err := os.MkdirAll(courseDir, 0755); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create directory: " + err.Error()})
	}

	// Gather uploaded files: support both "files" (multiple) and "file" (single)
	var uploadHeaders []*multipart.FileHeader
	form, formErr := c.MultipartForm()
	if formErr == nil && form != nil {
		if files, ok := form.File["files"]; ok && len(files) > 0 {
			uploadHeaders = append(uploadHeaders, files...)
		} else if files, ok := form.File["file"]; ok && len(files) > 0 {
			uploadHeaders = append(uploadHeaders, files...)
		}
	} else {
		singleFile, singleErr := c.FormFile("file")
		if singleErr == nil && singleFile != nil {
			uploadHeaders = append(uploadHeaders, singleFile)
		}
	}

	if len(uploadHeaders) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาเลือกไฟล์แนบอย่างน้อย 1 ไฟล์"})
	}

	// Read existing attachment list
	var currentList []CourseAttachmentItem
	var rawJSON string
	if attachType == "description" {
		rawJSON = course.DescriptionFiles
	} else {
		rawJSON = course.StructureFiles
	}

	if rawJSON != "" && rawJSON != "[]" {
		_ = json.Unmarshal([]byte(rawJSON), &currentList)
	} else {
		// Fallback from legacy single file if present
		legacyPath := course.DescriptionFilePath
		legacyType := course.DescriptionFileType
		if attachType == "structure" {
			legacyPath = course.StructureFilePath
			legacyType = course.StructureFileType
		}
		if legacyPath != "" {
			currentList = append(currentList, CourseAttachmentItem{
				URL:  legacyPath,
				Type: legacyType,
				Name: filepath.Base(legacyPath),
			})
		}
	}

	// Process each uploaded file
	for idx, fileHeader := range uploadHeaders {
		origName := fileHeader.Filename
		ext := strings.ToLower(filepath.Ext(origName))
		fileKind := "image"
		if ext == ".pdf" {
			fileKind = "pdf"
		} else if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp" {
			continue // skip unsupported files
		}

		destFilename := fmt.Sprintf("%s_%d_%d%s", attachType, time.Now().UnixNano(), idx, ext)
		destPath := filepath.Join(courseDir, destFilename)

		if err := c.SaveFile(fileHeader, destPath); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to save file: " + err.Error()})
		}

		relURL := fmt.Sprintf("/uploads/courses/%s/%s", courseID.String(), destFilename)

		// If it's a PDF, we can either replace or append. Replacing if only 1 PDF is preferred, but appending is also valid.
		if fileKind == "pdf" && len(uploadHeaders) == 1 {
			// If uploading a single PDF, replace existing list with this PDF
			currentList = []CourseAttachmentItem{
				{
					URL:  relURL,
					Type: fileKind,
					Name: origName,
				},
			}
		} else {
			// If images, append to list
			currentList = append(currentList, CourseAttachmentItem{
				URL:  relURL,
				Type: fileKind,
				Name: origName,
			})
		}
	}

	updatedJSONBytes, _ := json.Marshal(currentList)
	updatedJSON := string(updatedJSONBytes)

	// Save back to model
	if attachType == "description" {
		course.DescriptionFiles = updatedJSON
		if len(currentList) > 0 {
			course.DescriptionFilePath = currentList[0].URL
			course.DescriptionFileType = currentList[0].Type
		} else {
			course.DescriptionFilePath = ""
			course.DescriptionFileType = ""
		}
	} else {
		course.StructureFiles = updatedJSON
		if len(currentList) > 0 {
			course.StructureFilePath = currentList[0].URL
			course.StructureFileType = currentList[0].Type
		} else {
			course.StructureFilePath = ""
			course.StructureFileType = ""
		}
	}

	if course.TargetRooms == "" {
		course.TargetRooms = "[]"
	}
	if course.DescriptionFiles == "" {
		course.DescriptionFiles = "[]"
	}
	if course.StructureFiles == "" {
		course.StructureFiles = "[]"
	}

	if err := database.DB.Save(&course).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update course: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":  "อัปโหลดไฟล์แนบสำเร็จ",
		"type":     attachType,
		"files":    currentList,
		"filePath": course.DescriptionFilePath,
		"course":   course,
	})
}

// DeleteCourseAttachment removes an uploaded attachment (all or by index)
func DeleteCourseAttachment(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course ID"})
	}

	var course models.Course
	if err := database.DB.First(&course, courseID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Course not found"})
	}

	attachType := strings.ToLower(strings.TrimSpace(c.Params("type")))
	if attachType != "description" && attachType != "structure" {
		return c.Status(400).JSON(fiber.Map{"error": "Type must be either 'description' or 'structure'"})
	}

	// Read existing attachment list
	var currentList []CourseAttachmentItem
	var rawJSON string
	if attachType == "description" {
		rawJSON = course.DescriptionFiles
	} else {
		rawJSON = course.StructureFiles
	}

	if rawJSON != "" && rawJSON != "[]" {
		_ = json.Unmarshal([]byte(rawJSON), &currentList)
	} else {
		legacyPath := course.DescriptionFilePath
		legacyType := course.DescriptionFileType
		if attachType == "structure" {
			legacyPath = course.StructureFilePath
			legacyType = course.StructureFileType
		}
		if legacyPath != "" {
			currentList = append(currentList, CourseAttachmentItem{
				URL:  legacyPath,
				Type: legacyType,
				Name: filepath.Base(legacyPath),
			})
		}
	}

	indexParam := c.Query("index") // If present, delete specific item e.g. ?index=0
	if indexParam != "" {
		idx, err := strconv.Atoi(indexParam)
		if err == nil && idx >= 0 && idx < len(currentList) {
			itemToRemove := currentList[idx]
			// Remove from disk
			if itemToRemove.URL != "" {
				localPath := strings.TrimPrefix(itemToRemove.URL, "/")
				_ = os.Remove(localPath)
			}
			// Remove from slice
			currentList = append(currentList, CourseAttachmentItem{})
			copy(currentList[idx:], currentList[idx+1:])
			currentList = currentList[:len(currentList)-1]
		}
	} else {
		// Remove all files
		for _, item := range currentList {
			if item.URL != "" {
				localPath := strings.TrimPrefix(item.URL, "/")
				_ = os.Remove(localPath)
			}
		}
		currentList = []CourseAttachmentItem{}
	}

	updatedJSONBytes, _ := json.Marshal(currentList)
	updatedJSON := string(updatedJSONBytes)

	if attachType == "description" {
		course.DescriptionFiles = updatedJSON
		if len(currentList) > 0 {
			course.DescriptionFilePath = currentList[0].URL
			course.DescriptionFileType = currentList[0].Type
		} else {
			course.DescriptionFilePath = ""
			course.DescriptionFileType = ""
		}
	} else {
		course.StructureFiles = updatedJSON
		if len(currentList) > 0 {
			course.StructureFilePath = currentList[0].URL
			course.StructureFileType = currentList[0].Type
		} else {
			course.StructureFilePath = ""
			course.StructureFileType = ""
		}
	}

	if course.TargetRooms == "" {
		course.TargetRooms = "[]"
	}
	if course.DescriptionFiles == "" {
		course.DescriptionFiles = "[]"
	}
	if course.StructureFiles == "" {
		course.StructureFiles = "[]"
	}

	if err := database.DB.Save(&course).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update course: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "ลบไฟล์แนบเรียบร้อยแล้ว",
		"files":   currentList,
		"course":  course,
	})
}

