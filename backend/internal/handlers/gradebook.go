package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"newtea-backend/internal/database"
	"newtea-backend/internal/middleware"
	"newtea-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GetPeriodRound maps period type (1:ก่อนกลาง, 2:กลาง, 3:หลังกลาง, 4:ปลายภาค) to verification round (1, 2, 3)
func GetPeriodRound(periodType int) int {
	switch periodType {
	case 1:
		return 1
	case 2:
		return 2
	case 3, 4:
		return 3
	default:
		return 1
	}
}

// IsRoundLocked checks whether editing is locked for a specific verification round
func IsRoundLocked(courseID uuid.UUID, round int, user *models.User) bool {
	if user != nil && strings.EqualFold(user.Role, "ADMIN") {
		return false // ADMIN bypass
	}
	var ver models.CourseVerification
	if err := database.DB.Where("course_id = ? AND round = ?", courseID, round).First(&ver).Error; err != nil {
		return false
	}
	// Locked if teacher submitted and not returned for revision (neither DeptHead nor Academic marked REVISE)
	if ver.TeacherSubmitted && ver.DeptHeadStatus != "REVISE" && ver.AcademicStatus != "REVISE" {
		return true
	}
	return false
}

// CheckTeacherRoomPermission validates whether a user can edit scores or evaluations for a specific classroom.
// - Admins and Academic staff can edit any room.
// - In TUNorth's Strict Room Isolation model: each teacher only edits classrooms assigned to them.
// - If a course has only 1 teacher, that teacher has access to all rooms in the course.
func CheckTeacherRoomPermission(courseID uuid.UUID, user *models.User, roomID string) (bool, string) {
	if user == nil {
		return false, "กรุณาเข้าสู่ระบบก่อนทำรายการ"
	}
	if strings.EqualFold(user.Role, "ADMIN") || strings.EqualFold(user.Role, "ACADEMIC") {
		return true, ""
	}

	var myAssignment models.CourseTeacher
	if err := database.DB.Where("course_id = ? AND user_id = ?", courseID, user.ID).First(&myAssignment).Error; err != nil {
		return false, "คุณไม่ได้เป็นครูผู้สอนในรายวิชานี้"
	}

	var teacherCount int64
	database.DB.Model(&models.CourseTeacher{}).Where("course_id = ?", courseID).Count(&teacherCount)
	if teacherCount <= 1 {
		return true, ""
	}

	var assignedRooms []string
	if myAssignment.AssignedRooms != "" && myAssignment.AssignedRooms != "[]" {
		_ = json.Unmarshal([]byte(myAssignment.AssignedRooms), &assignedRooms)
	}

	if len(assignedRooms) == 0 {
		return false, fmt.Sprintf("คุณยังไม่ได้รับมอบหมายห้องเรียน %s ในรายวิชานี้", roomID)
	}

	for _, r := range assignedRooms {
		if strings.TrimSpace(r) == strings.TrimSpace(roomID) {
			return true, ""
		}
	}

	return false, fmt.Sprintf("คุณไม่มีสิทธิ์แก้ไขคะแนนของห้อง %s เนื่องจากอยู่ในความรับผิดชอบของครูท่านอื่น", roomID)
}

// CalculateStandardGrade converts a total score (0-100) to standard Thai grade
func CalculateStandardGrade(totalScore float64) string {
	rounded := math.Round(totalScore*100) / 100
	switch {
	case rounded >= 80:
		return "4"
	case rounded >= 75:
		return "3.5"
	case rounded >= 70:
		return "3"
	case rounded >= 65:
		return "2.5"
	case rounded >= 60:
		return "2"
	case rounded >= 55:
		return "1.5"
	case rounded >= 50:
		return "1"
	default:
		return "0"
	}
}

// CalculateAuto3DAssessment maps grade to 3-scale evaluation (1:ผ่าน, 2:ดี, 3:ดีเยี่ยม)
func CalculateAuto3DAssessment(grade string, specialGrade string) int {
	if specialGrade == "มส" || specialGrade == "ร" {
		return 1 // ผ่าน / พอใช้
	}
	switch grade {
	case "4", "3.5", "3", "2.5", "2":
		return 3 // ดีเยี่ยม
	case "1.5", "1":
		return 2 // ดี
	default:
		return 1 // ผ่าน
	}
}

// MapGradeToAspectLevel maps a grade to an assessment level using the criteria config
func MapGradeToAspectLevel(grade string, specialGrade string, criteria AssessmentAspectCriteria, specialRules SpecialGradeCriteria) int {
	if specialGrade == "มส" {
		return specialRules.MsLevel
	}
	if specialGrade == "ร" {
		return specialRules.RLevel
	}

	gradeVal := 0.0
	switch grade {
	case "4":
		gradeVal = 4.0
	case "3.5":
		gradeVal = 3.5
	case "3":
		gradeVal = 3.0
	case "2.5":
		gradeVal = 2.5
	case "2":
		gradeVal = 2.0
	case "1.5":
		gradeVal = 1.5
	case "1":
		gradeVal = 1.0
	default:
		gradeVal = 0.0
	}

	if gradeVal >= criteria.ExcellentMinGrade {
		return 3
	}
	if gradeVal >= criteria.GoodMinGrade {
		return 2
	}
	if gradeVal >= criteria.PassMinGrade {
		return 1
	}
	return 0
}

// GenerateSubscoresArray returns a JSON array string e.g. "[3,3,3,3,3,3,3,3]"
func GenerateSubscoresArray(count int, level int) string {
	items := make([]int, count)
	for i := 0; i < count; i++ {
		items[i] = level
	}
	bytes, _ := json.Marshal(items)
	return string(bytes)
}

// GenerateDesirableSubscoresArray returns a JSON array string e.g. "[3,3,2,2,2,2,2,3]"
// Items 1, 2, and 8 (indices 0, 1, 7) remain 3 (ดีเยี่ยม) for all academic grades
func GenerateDesirableSubscoresArray(level int) string {
	items := make([]int, 8)
	for i := 0; i < 8; i++ {
		if i == 0 || i == 1 || i == 7 {
			items[i] = 3
		} else {
			items[i] = level
		}
	}
	bytes, _ := json.Marshal(items)
	return string(bytes)
}

// CalculateAttendancePercentage computes the attendance percentage and whether student has "มส" (<80%)
func CalculateAttendancePercentage(period1Hours, period2Hours, maxPeriod1Hours, maxPeriod2Hours float64) (float64, bool) {
	maxTotal := maxPeriod1Hours + maxPeriod2Hours
	if maxTotal <= 0 {
		return 100.0, false
	}
	totalAttended := period1Hours + period2Hours
	if totalAttended < 0 {
		totalAttended = 0
	}
	pct := math.Round((totalAttended/maxTotal)*1000) / 10
	if pct > 100.0 {
		pct = 100.0
	}
	isMs := pct < 80.0
	return pct, isMs
}

// GetGradebook returns full gradebook data for a course
func GetGradebook(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	roomID := c.Query("room_id")

	// Ensure 3 verification rounds exist (Self-healing)
	_, _ = EnsureVerificationsExist(database.DB, courseID)

	// 1. Fetch Course
	var course models.Course
	err = database.DB.
		Preload("Term").
		Preload("Teachers.User").
		Preload("Verifications", func(db *gorm.DB) *gorm.DB {
			return db.Order("round asc")
		}).
		Where("id = ?", courseID).
		First(&course).Error
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Course not found"})
	}

	if course.AttendanceMaxPeriod1 == 0 && course.AttendanceMaxPeriod2 == 0 {
		half := float64(course.TotalHours) / 2.0
		if half <= 0 {
			half = 20.0
		}
		course.AttendanceMaxPeriod1 = half
		course.AttendanceMaxPeriod2 = half
		database.DB.Model(&course).Updates(map[string]interface{}{
			"attendance_max_period1": course.AttendanceMaxPeriod1,
			"attendance_max_period2": course.AttendanceMaxPeriod2,
		})
	}

	// 2. Fetch Score Columns ordered by sequence
	var scoreColumns []models.ScoreColumn
	database.DB.
		Where("course_id = ?", courseID).
		Order("sequence asc, created_at asc").
		Find(&scoreColumns)

	// 3. Fetch Distinct Rooms in Course
	var rooms []string
	database.DB.Model(&models.CourseEnrollment{}).
		Where("course_id = ?", courseID).
		Group("room_id").
		Order("SPLIT_PART(room_id, '.', 1)::int asc, SPLIT_PART(room_id, '.', 2)::int asc").
		Pluck("room_id", &rooms)

	if len(rooms) == 0 && course.TargetRooms != "" {
		_ = json.Unmarshal([]byte(course.TargetRooms), &rooms)
	}

	// 4. Fetch Enrollments with Student, Scores, and Evaluation
	enrollmentQuery := database.DB.
		Preload("Student").
		Preload("Evaluation").
		Preload("Scores").
		Where("course_id = ?", courseID)

	if roomID != "" {
		enrollmentQuery = enrollmentQuery.Where("room_id = ?", roomID)
	}

	var enrollments []models.CourseEnrollment
	if err := enrollmentQuery.Order("SPLIT_PART(room_id, '.', 1)::int asc, SPLIT_PART(room_id, '.', 2)::int asc, seat_no asc").Find(&enrollments).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch enrollments: " + err.Error()})
	}

	// 5. Structure data for TanStack Table Grid
	type GradebookStudentDTO struct {
		EnrollmentID   string                  `json:"enrollmentId"`
		StudentID      string                  `json:"studentId"`
		StudentCode    string                  `json:"studentCode"`
		Prefix         string                  `json:"prefix"`
		FirstName      string                  `json:"firstName"`
		LastName       string                  `json:"lastName"`
		RoomID         string                  `json:"roomId"`
		SeatNo         int                     `json:"seatNo"`
		LanguageGroup  string                  `json:"languageGroup"`
		ElectiveGroup  string                  `json:"electiveGroup"`
		Status         string                  `json:"status"`        // Enrollment status e.g. "ENROLLED"
		StudentStatus  string                  `json:"studentStatus"` // Student master status e.g. "ACTIVE", "TRANSFERRED", "RESIGNED", "SUSPENDED"
		Scores         map[string]float64      `json:"scores"`         // scoreColumnId -> score
		AbsentMap      map[string]bool         `json:"absentMap"`      // scoreColumnId -> isAbsent
		RemarksMap     map[string]string       `json:"remarksMap"`     // scoreColumnId -> remarks
		Evaluation     *models.StudentEvaluation `json:"evaluation"`
	}

	studentsDTO := make([]GradebookStudentDTO, len(enrollments))
	for i, e := range enrollments {
		scoresMap := make(map[string]float64)
		absentMap := make(map[string]bool)
		remarksMap := make(map[string]string)

		for _, sc := range e.Scores {
			colKey := sc.ScoreColumnID.String()
			scoresMap[colKey] = sc.Score
			absentMap[colKey] = sc.IsAbsent
			if sc.Remarks != "" {
				remarksMap[colKey] = sc.Remarks
			}
		}

		eval := e.Evaluation
		if eval != nil {
			if eval.AttendanceHoursPeriod1 == 0 && eval.AttendanceHoursPeriod2 == 0 && eval.AttendancePercentage >= 80.0 {
				eval.AttendanceHoursPeriod1 = course.AttendanceMaxPeriod1
				eval.AttendanceHoursPeriod2 = course.AttendanceMaxPeriod2
				if eval.AttendanceHours == 0 {
					eval.AttendanceHours = int(course.AttendanceMaxPeriod1 + course.AttendanceMaxPeriod2)
				}
			}
		}

		studentsDTO[i] = GradebookStudentDTO{
			EnrollmentID:  e.ID.String(),
			StudentID:     e.StudentID.String(),
			StudentCode:   e.Student.StudentCode,
			Prefix:        e.Student.Prefix,
			FirstName:     e.Student.FirstName,
			LastName:      e.Student.LastName,
			RoomID:        e.RoomID,
			SeatNo:        e.SeatNo,
			LanguageGroup: e.Student.LanguageGroup,
			ElectiveGroup: e.Student.ElectiveGroup,
			Status:        e.Status,
			StudentStatus: e.Student.Status,
			Scores:        scoresMap,
			AbsentMap:     absentMap,
			RemarksMap:    remarksMap,
			Evaluation:    eval,
		}
	}

	// 6. Fetch Room Advisors for all rooms in course
	var advisors []models.RoomAdvisor
	if len(rooms) > 0 {
		database.DB.Preload("User").
			Where("room_id IN ?", rooms).
			Order("advisor_order asc").
			Find(&advisors)
	}
	advisorsByRoom := make(map[string][]string)
	for _, a := range advisors {
		if a.User.Name != "" {
			advisorsByRoom[a.RoomID] = append(advisorsByRoom[a.RoomID], a.User.Name)
		}
	}

	return c.JSON(fiber.Map{
		"course":         course,
		"rooms":          rooms,
		"advisorsByRoom": advisorsByRoom,
		"scoreColumns":   scoreColumns,
		"total":          len(studentsDTO),
		"students":       studentsDTO,
	})
}

// CreateScoreColumnInput defines request body for adding a score column
type CreateScoreColumnInput struct {
	Name       string  `json:"name"`
	MaxScore   float64 `json:"maxScore"`
	Weight     float64 `json:"weight"`
	PeriodType int     `json:"periodType"` // 1:ก่อนกลาง, 2:กลาง, 3:หลังกลาง, 4:ปลายภาค
	Sequence   int     `json:"sequence"`
}

// CreateScoreColumn adds a new column to the gradebook
func CreateScoreColumn(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	var input CreateScoreColumnInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if input.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "ชื่อช่องคะแนนจำเป็นต้องระบุ"})
	}
	if input.MaxScore <= 0 {
		input.MaxScore = 10.0
	}
	if input.Weight <= 0 {
		input.Weight = input.MaxScore
	}
	if input.PeriodType < 1 || input.PeriodType > 4 {
		input.PeriodType = 1
	}

	// Lock check
	user := middleware.GetCurrentUser(c)
	round := GetPeriodRound(input.PeriodType)
	if IsRoundLocked(courseID, round, user) {
		return c.Status(403).JSON(fiber.Map{
			"error": fmt.Sprintf("ไม่สามารถเพิ่มช่องคะแนนในระยะที่ %d ได้ เนื่องจากส่งตรวจแล้วและตารางถูกล็อก", round),
		})
	}

	// Auto sequence if not specified
	if input.Sequence <= 0 {
		var maxSeq int
		database.DB.Model(&models.ScoreColumn{}).
			Where("course_id = ?", courseID).
			Select("COALESCE(MAX(sequence), 0)").
			Scan(&maxSeq)
		input.Sequence = maxSeq + 1
	}

	column := models.ScoreColumn{
		ID:         uuid.New(),
		CourseID:   courseID,
		Name:       input.Name,
		MaxScore:   input.MaxScore,
		Weight:     input.Weight,
		PeriodType: input.PeriodType,
		Sequence:   input.Sequence,
		CreatedAt:  time.Now(),
	}

	if err := database.DB.Create(&column).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create score column: " + err.Error()})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "เพิ่มช่องคะแนนสำเร็จ",
		"column":  column,
	})
}

// UpdateScoreColumn updates an existing score column
func UpdateScoreColumn(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	colIDStr := c.Params("colId")
	colID, err := uuid.Parse(colIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid column id"})
	}

	var column models.ScoreColumn
	if err := database.DB.Where("id = ? AND course_id = ?", colID, courseID).First(&column).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Score column not found"})
	}

	// Lock check
	user := middleware.GetCurrentUser(c)
	round := GetPeriodRound(column.PeriodType)
	if IsRoundLocked(courseID, round, user) {
		return c.Status(403).JSON(fiber.Map{
			"error": fmt.Sprintf("ไม่สามารถแก้ไขช่องคะแนน %s ได้ เนื่องจากระยะที่ %d ส่งตรวจแล้วและถูกล็อก", column.Name, round),
		})
	}

	var input CreateScoreColumnInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if input.Name != "" {
		column.Name = input.Name
	}
	if input.MaxScore > 0 {
		column.MaxScore = input.MaxScore
	}
	if input.Weight > 0 {
		column.Weight = input.Weight
	}
	if input.PeriodType >= 1 && input.PeriodType <= 4 {
		column.PeriodType = input.PeriodType
	}
	if input.Sequence > 0 {
		column.Sequence = input.Sequence
	}

	if err := database.DB.Save(&column).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update score column: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "แก้ไขช่องคะแนนสำเร็จ",
		"column":  column,
	})
}

// DeleteScoreColumn deletes a score column and its associated student scores
func DeleteScoreColumn(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	colIDStr := c.Params("colId")
	colID, err := uuid.Parse(colIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid column id"})
	}

	var column models.ScoreColumn
	if err := database.DB.Where("id = ? AND course_id = ?", colID, courseID).First(&column).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Score column not found"})
	}

	// Lock check
	user := middleware.GetCurrentUser(c)
	round := GetPeriodRound(column.PeriodType)
	if IsRoundLocked(courseID, round, user) {
		return c.Status(403).JSON(fiber.Map{
			"error": fmt.Sprintf("ไม่สามารถลบช่องคะแนน %s ได้ เนื่องจากระยะที่ %d ส่งตรวจแล้วและถูกล็อก", column.Name, round),
		})
	}

	tx := database.DB.Begin()
	// Delete student scores for this column
	tx.Where("score_column_id = ?", colID).Delete(&models.StudentScore{})
	if err := tx.Delete(&column).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete score column: " + err.Error()})
	}
	tx.Commit()

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("ลบช่องคะแนน %s สำเร็จ", column.Name),
	})
}

// ScoreUpdateItem represents an individual student's score in a column
type ScoreUpdateItem struct {
	EnrollmentID  string  `json:"enrollmentId"`
	ScoreColumnID string  `json:"scoreColumnId"`
	Score         float64 `json:"score"`
	IsAbsent      bool    `json:"isAbsent"`
	Remarks       string  `json:"remarks"`
}

// BatchSaveScores handles real-time auto-save of scores and recalculates grades
func BatchSaveScores(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	var updates []ScoreUpdateItem
	if err := c.BodyParser(&updates); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if len(updates) == 0 {
		return c.JSON(fiber.Map{"message": "No scores to update"})
	}

	// 1. Fetch all ScoreColumns for this course to calculate weighted total
	var columns []models.ScoreColumn
	database.DB.Where("course_id = ?", courseID).Find(&columns)
	colMap := make(map[uuid.UUID]models.ScoreColumn)
	for _, col := range columns {
		colMap[col.ID] = col
	}

	// Lock check and Room Permission check for incoming score updates
	user := middleware.GetCurrentUser(c)

	// Collect unique enrollment IDs to check room ownership
	var enrollmentUUIDs []uuid.UUID
	for _, u := range updates {
		if eUUID, err := uuid.Parse(u.EnrollmentID); err == nil {
			enrollmentUUIDs = append(enrollmentUUIDs, eUUID)
		}
	}

	var enrollments []models.CourseEnrollment
	database.DB.Where("id IN (?) AND course_id = ?", enrollmentUUIDs, courseID).Find(&enrollments)
	enrollmentRoomMap := make(map[uuid.UUID]string)
	for _, e := range enrollments {
		enrollmentRoomMap[e.ID] = e.RoomID
	}

	for _, u := range updates {
		if eUUID, err := uuid.Parse(u.EnrollmentID); err == nil {
			if roomID, exists := enrollmentRoomMap[eUUID]; exists && roomID != "" {
				allowed, errMsg := CheckTeacherRoomPermission(courseID, user, roomID)
				if !allowed {
					return c.Status(403).JSON(fiber.Map{"error": errMsg})
				}
			}
		}

		if scoreColUUID, err := uuid.Parse(u.ScoreColumnID); err == nil {
			if col, exists := colMap[scoreColUUID]; exists {
				round := GetPeriodRound(col.PeriodType)
				if IsRoundLocked(courseID, round, user) {
					return c.Status(403).JSON(fiber.Map{
						"error": fmt.Sprintf("ไม่สามารถบันทึกคะแนนในช่อง '%s' ได้ เนื่องจากระยะที่ %d ส่งตรวจแล้วและถูกล็อกการแก้ไข", col.Name, round),
					})
				}
			}
		}
	}

	tx := database.DB.Begin()

	affectedEnrollments := make(map[uuid.UUID]bool)

	// 2. Upsert scores
	for _, u := range updates {
		enrollmentUUID, err := uuid.Parse(u.EnrollmentID)
		if err != nil {
			continue
		}
		scoreColUUID, err := uuid.Parse(u.ScoreColumnID)
		if err != nil {
			continue
		}

		affectedEnrollments[enrollmentUUID] = true

		// Validate score bounds against MaxScore
		if col, exists := colMap[scoreColUUID]; exists {
			if u.Score > col.MaxScore {
				u.Score = col.MaxScore
			}
			if u.Score < 0 {
				u.Score = 0
			}
		}

		var score models.StudentScore
		err = tx.Where("enrollment_id = ? AND score_column_id = ?", enrollmentUUID, scoreColUUID).First(&score).Error

		if err == gorm.ErrRecordNotFound {
			score = models.StudentScore{
				ID:            uuid.New(),
				EnrollmentID:  enrollmentUUID,
				ScoreColumnID: scoreColUUID,
				Score:         u.Score,
				IsAbsent:      u.IsAbsent,
				Remarks:       u.Remarks,
				UpdatedAt:     time.Now(),
			}
			tx.Create(&score)
		} else {
			score.Score = u.Score
			score.IsAbsent = u.IsAbsent
			score.Remarks = u.Remarks
			score.UpdatedAt = time.Now()
			tx.Save(&score)
		}
	}

	// 3. Recalculate Total Score, Grade, and Auto 3D Assessment for each affected enrollment
	type RecalcResult struct {
		EnrollmentID string  `json:"enrollmentId"`
		TotalScore   float64 `json:"totalScore"`
		Grade        string  `json:"grade"`
		SpecialGrade string  `json:"specialGrade"`
	}
	recalcResults := make([]RecalcResult, 0, len(affectedEnrollments))
	criteria := LoadCurrentAssessmentCriteria()

	for enrollmentID := range affectedEnrollments {
		var allScores []models.StudentScore
		tx.Where("enrollment_id = ?", enrollmentID).Find(&allScores)

		var totalScore float64
		for _, s := range allScores {
			if s.IsAbsent {
				continue
			}
			col, exists := colMap[s.ScoreColumnID]
			if exists && col.MaxScore > 0 {
				// Normalize score to column weight
				weightedScore := (s.Score / col.MaxScore) * col.Weight
				totalScore += weightedScore
			} else {
				totalScore += s.Score
			}
		}

		totalScore = math.Round(totalScore*100) / 100
		grade := CalculateStandardGrade(totalScore)

		var eval models.StudentEvaluation
		err := tx.Where("enrollment_id = ?", enrollmentID).First(&eval).Error
		if err == gorm.ErrRecordNotFound {
			eval = models.StudentEvaluation{
				ID:                   uuid.New(),
				EnrollmentID:         enrollmentID,
				AttendancePercentage: 100.0,
				DesirableSubscores:   "[]",
				ReadingSubscores:     "[]",
				CompetencySubscores:  "[]",
			}
		}

		eval.TotalScore = totalScore
		eval.Grade = grade

		// Time attendance check (<80% -> มส)
		if eval.AttendancePercentage < 80.0 {
			eval.SpecialGrade = "มส"
			eval.Grade = "0"
		} else if eval.SpecialGrade == "มส" {
			// Clear มส if attendance percentage is >= 80%
			eval.SpecialGrade = ""
		}

		// Auto-map 3D assessment if teacher has not overridden
		if !eval.IsOverridden {
			desirableLevel := MapGradeToAspectLevel(eval.Grade, eval.SpecialGrade, criteria.Desirable, criteria.SpecialGradeRules)
			readingLevel := MapGradeToAspectLevel(eval.Grade, eval.SpecialGrade, criteria.Reading, criteria.SpecialGradeRules)
			competencyLevel := MapGradeToAspectLevel(eval.Grade, eval.SpecialGrade, criteria.Competency, criteria.SpecialGradeRules)

			eval.DesirableGrade = desirableLevel
			eval.DesirableSubscores = GenerateDesirableSubscoresArray(desirableLevel)

			eval.ReadingGrade = readingLevel
			eval.ReadingSubscores = GenerateSubscoresArray(5, readingLevel)

			eval.CompetencyGrade = competencyLevel
			eval.CompetencySubscores = GenerateSubscoresArray(5, competencyLevel)
		}

		eval.UpdatedAt = time.Now()
		tx.Save(&eval)

		recalcResults = append(recalcResults, RecalcResult{
			EnrollmentID: enrollmentID.String(),
			TotalScore:   eval.TotalScore,
			Grade:        eval.Grade,
			SpecialGrade: eval.SpecialGrade,
		})
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Transaction failed: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("บันทึกคะแนนสำเร็จ %d รายการ", len(updates)),
		"results": recalcResults,
	})
}

// UpdateStudentEvaluationInput defines payload for teacher overriding assessment/attendance
type UpdateStudentEvaluationInput struct {
	AttendanceHoursPeriod1 *float64 `json:"attendanceHoursPeriod1"`
	AttendanceHoursPeriod2 *float64 `json:"attendanceHoursPeriod2"`
	AttendanceHours        *int     `json:"attendanceHours"`
	AttendancePercentage   *float64 `json:"attendancePercentage"`
	SpecialGrade           *string  `json:"specialGrade"` // มส, ร, ผ, มผ, or ""
	DesirableSubscores     *string  `json:"desirableSubscores"`
	DesirableGrade         *int     `json:"desirableGrade"`
	ReadingSubscores       *string  `json:"readingSubscores"`
	ReadingGrade           *int     `json:"readingGrade"`
	CompetencySubscores    *string  `json:"competencySubscores"`
	CompetencyGrade        *int     `json:"competencyGrade"`
	IsOverridden           bool     `json:"isOverridden"`
	OverrideReason         string   `json:"overrideReason"`
}

// UpdateStudentEvaluation allows manual override of student attendance and 3D assessments
func UpdateStudentEvaluation(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	user := middleware.GetCurrentUser(c)
	if IsRoundLocked(courseID, 3, user) {
		return c.Status(403).JSON(fiber.Map{
			"error": "ไม่สามารถปรับแก้ผลการประเมินหรือเวลาเรียนได้ เนื่องจากระยะที่ 3 (ปลายภาค) ส่งตรวจแล้วและถูกล็อกการแก้ไข",
		})
	}

	evalIDStr := c.Params("evalId")
	evalID, err := uuid.Parse(evalIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid evaluation id"})
	}

	var eval models.StudentEvaluation
	if err := database.DB.Where("id = ?", evalID).First(&eval).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Student evaluation not found"})
	}

	var enrollment models.CourseEnrollment
	if err := database.DB.Where("id = ?", eval.EnrollmentID).First(&enrollment).Error; err == nil {
		allowed, errMsg := CheckTeacherRoomPermission(courseID, user, enrollment.RoomID)
		if !allowed {
			return c.Status(403).JSON(fiber.Map{"error": errMsg})
		}
	}

	var input UpdateStudentEvaluationInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if input.AttendanceHoursPeriod1 != nil {
		eval.AttendanceHoursPeriod1 = *input.AttendanceHoursPeriod1
	}
	if input.AttendanceHoursPeriod2 != nil {
		eval.AttendanceHoursPeriod2 = *input.AttendanceHoursPeriod2
	}
	if input.AttendanceHoursPeriod1 != nil || input.AttendanceHoursPeriod2 != nil {
		eval.AttendanceHours = int(math.Round(eval.AttendanceHoursPeriod1 + eval.AttendanceHoursPeriod2))
	}

	if input.AttendanceHours != nil {
		eval.AttendanceHours = *input.AttendanceHours
	}
	if input.AttendancePercentage != nil {
		eval.AttendancePercentage = *input.AttendancePercentage
		// Attendance rule: <80% -> มส
		if eval.AttendancePercentage < 80.0 {
			eval.SpecialGrade = "มส"
			eval.Grade = "0"
		} else if eval.SpecialGrade == "มส" {
			eval.SpecialGrade = ""
			eval.Grade = CalculateStandardGrade(eval.TotalScore)
		}
	}

	if input.SpecialGrade != nil {
		eval.SpecialGrade = *input.SpecialGrade
		if eval.SpecialGrade == "มส" || eval.SpecialGrade == "ร" {
			eval.Grade = "0"
		}
	}

	if input.DesirableSubscores != nil {
		eval.DesirableSubscores = *input.DesirableSubscores
	}
	if input.DesirableGrade != nil && *input.DesirableGrade >= 0 && *input.DesirableGrade <= 3 {
		eval.DesirableGrade = *input.DesirableGrade
	}
	if input.ReadingSubscores != nil {
		eval.ReadingSubscores = *input.ReadingSubscores
	}
	if input.ReadingGrade != nil && *input.ReadingGrade >= 0 && *input.ReadingGrade <= 3 {
		eval.ReadingGrade = *input.ReadingGrade
	}
	if input.CompetencySubscores != nil {
		eval.CompetencySubscores = *input.CompetencySubscores
	}
	if input.CompetencyGrade != nil && *input.CompetencyGrade >= 0 && *input.CompetencyGrade <= 3 {
		eval.CompetencyGrade = *input.CompetencyGrade
	}

	eval.IsOverridden = input.IsOverridden
	if input.OverrideReason != "" {
		eval.OverrideReason = input.OverrideReason
	}
	eval.UpdatedAt = time.Now()

	if err := database.DB.Save(&eval).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update evaluation: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":    "ปรับแก้ผลการประเมินสำเร็จ",
		"evaluation": eval,
	})
}

// ResetScoreColumnsToDefault resets a course's columns to the standard 8 columns:
// 10+10+10 / 20 / 10+10+10 / 20
func ResetScoreColumnsToDefault(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	user := middleware.GetCurrentUser(c)
	if IsRoundLocked(courseID, 1, user) || IsRoundLocked(courseID, 2, user) || IsRoundLocked(courseID, 3, user) {
		return c.Status(403).JSON(fiber.Map{
			"error": "ไม่สามารถรีเซ็ตช่องคะแนนได้ เนื่องจากมีระยะที่ส่งตรวจแล้วและถูกล็อกการแก้ไข",
		})
	}

	tx := database.DB.Begin()

	// 1. Delete existing scores for this course's columns
	var existingCols []models.ScoreColumn
	tx.Where("course_id = ?", courseID).Find(&existingCols)
	colIDs := make([]uuid.UUID, len(existingCols))
	for i, col := range existingCols {
		colIDs[i] = col.ID
	}
	if len(colIDs) > 0 {
		tx.Where("score_column_id IN (?)", colIDs).Delete(&models.StudentScore{})
		tx.Where("course_id = ?", courseID).Delete(&models.ScoreColumn{})
	}

	// 2. Create default columns
	defaultCols := GetDefaultScoreColumns(courseID)
	for _, col := range defaultCols {
		if err := tx.Create(&col).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create default columns: " + err.Error()})
		}
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Transaction commit failed: " + err.Error()})
	}

	var newCols []models.ScoreColumn
	database.DB.Where("course_id = ?", courseID).Order("sequence asc").Find(&newCols)

	return c.JSON(fiber.Map{
		"message": "รีเซ็ตช่องคะแนนเป็นค่ามาตรฐาน (10+10+10 / 20 / 10+10+10 / 20) สำเร็จ",
		"columns": newCols,
	})
}

// EvaluationBatchItem represents payload item for bulk saving evaluations (3D and attendance)
type EvaluationBatchItem struct {
	EnrollmentID           string   `json:"enrollmentId"`
	AttendanceHoursPeriod1 *float64 `json:"attendanceHoursPeriod1,omitempty"`
	AttendanceHoursPeriod2 *float64 `json:"attendanceHoursPeriod2,omitempty"`
	DesirableSubscores     *[]int   `json:"desirableSubscores,omitempty"`
	DesirableGrade         *int     `json:"desirableGrade,omitempty"`
	ReadingSubscores       *[]int   `json:"readingSubscores,omitempty"`
	ReadingGrade           *int     `json:"readingGrade,omitempty"`
	CompetencySubscores    *[]int   `json:"competencySubscores,omitempty"`
	CompetencyGrade        *int     `json:"competencyGrade,omitempty"`
	IsOverridden           *bool    `json:"isOverridden,omitempty"`
}

// BatchSaveEvaluations updates 3D evaluations and attendance in batch
func BatchSaveEvaluations(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	user := middleware.GetCurrentUser(c)
	if IsRoundLocked(courseID, 3, user) {
		return c.Status(403).JSON(fiber.Map{
			"error": "ไม่สามารถบันทึกการประเมินหรือเวลาเรียนได้ เนื่องจากระยะที่ 3 (ปลายภาค) ส่งตรวจแล้วและถูกล็อกการแก้ไข",
		})
	}

	var updates []EvaluationBatchItem
	if err := c.BodyParser(&updates); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body: " + err.Error()})
	}

	if len(updates) == 0 {
		return c.JSON(fiber.Map{"message": "No evaluations to update"})
	}

	// Collect enrollment UUIDs and verify Room Permissions
	var evalEnrollmentUUIDs []uuid.UUID
	for _, u := range updates {
		if eUUID, err := uuid.Parse(u.EnrollmentID); err == nil {
			evalEnrollmentUUIDs = append(evalEnrollmentUUIDs, eUUID)
		}
	}

	var evalEnrollments []models.CourseEnrollment
	database.DB.Where("id IN (?) AND course_id = ?", evalEnrollmentUUIDs, courseID).Find(&evalEnrollments)
	evalEnrollmentRoomMap := make(map[uuid.UUID]string)
	for _, e := range evalEnrollments {
		evalEnrollmentRoomMap[e.ID] = e.RoomID
	}

	for _, u := range updates {
		if eUUID, err := uuid.Parse(u.EnrollmentID); err == nil {
			if roomID, exists := evalEnrollmentRoomMap[eUUID]; exists && roomID != "" {
				allowed, errMsg := CheckTeacherRoomPermission(courseID, user, roomID)
				if !allowed {
					return c.Status(403).JSON(fiber.Map{"error": errMsg})
				}
			}
		}
	}

	var course models.Course
	database.DB.Where("id = ?", courseID).First(&course)
	if course.AttendanceMaxPeriod1 == 0 && course.AttendanceMaxPeriod2 == 0 {
		half := float64(course.TotalHours) / 2.0
		if half <= 0 {
			half = 20.0
		}
		course.AttendanceMaxPeriod1 = half
		course.AttendanceMaxPeriod2 = half
	}

	tx := database.DB.Begin()
	for _, u := range updates {
		enrollmentUUID, err := uuid.Parse(u.EnrollmentID)
		if err != nil {
			continue
		}

		var eval models.StudentEvaluation
		err = tx.Where("enrollment_id = ?", enrollmentUUID).First(&eval).Error
		isNew := false
		if err == gorm.ErrRecordNotFound {
			isNew = true
			eval = models.StudentEvaluation{
				ID:                     uuid.New(),
				EnrollmentID:           enrollmentUUID,
				AttendanceHoursPeriod1: course.AttendanceMaxPeriod1,
				AttendanceHoursPeriod2: course.AttendanceMaxPeriod2,
				AttendanceHours:        int(course.AttendanceMaxPeriod1 + course.AttendanceMaxPeriod2),
				AttendancePercentage:   100.0,
				Grade:                  "0",
			}
		}

		// Update Attendance Period 1 & 2
		attendanceChanged := false
		if u.AttendanceHoursPeriod1 != nil {
			eval.AttendanceHoursPeriod1 = *u.AttendanceHoursPeriod1
			attendanceChanged = true
		}
		if u.AttendanceHoursPeriod2 != nil {
			eval.AttendanceHoursPeriod2 = *u.AttendanceHoursPeriod2
			attendanceChanged = true
		}

		if attendanceChanged {
			pct, isMs := CalculateAttendancePercentage(
				eval.AttendanceHoursPeriod1,
				eval.AttendanceHoursPeriod2,
				course.AttendanceMaxPeriod1,
				course.AttendanceMaxPeriod2,
			)
			eval.AttendanceHours = int(math.Round(eval.AttendanceHoursPeriod1 + eval.AttendanceHoursPeriod2))
			eval.AttendancePercentage = pct

			if isMs {
				eval.SpecialGrade = "มส"
				eval.Grade = "0"
			} else if eval.SpecialGrade == "มส" {
				eval.SpecialGrade = ""
				eval.Grade = CalculateStandardGrade(eval.TotalScore)
			}
		}

		if u.DesirableSubscores != nil {
			bytes, _ := json.Marshal(*u.DesirableSubscores)
			eval.DesirableSubscores = string(bytes)
		}
		if u.DesirableGrade != nil {
			eval.DesirableGrade = *u.DesirableGrade
		}
		if u.ReadingSubscores != nil {
			bytes, _ := json.Marshal(*u.ReadingSubscores)
			eval.ReadingSubscores = string(bytes)
		}
		if u.ReadingGrade != nil {
			eval.ReadingGrade = *u.ReadingGrade
		}
		if u.CompetencySubscores != nil {
			bytes, _ := json.Marshal(*u.CompetencySubscores)
			eval.CompetencySubscores = string(bytes)
		}
		if u.CompetencyGrade != nil {
			eval.CompetencyGrade = *u.CompetencyGrade
		}
		if u.IsOverridden != nil {
			eval.IsOverridden = *u.IsOverridden
		}
		eval.UpdatedAt = time.Now()

		if isNew {
			tx.Create(&eval)
		} else {
			tx.Save(&eval)
		}
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save evaluations: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("บันทึกการประเมินสำเร็จ %d รายการ", len(updates)),
	})
}

// UpdateCourseAttendanceConfigInput payload for updating max attendance period hours
type UpdateCourseAttendanceConfigInput struct {
	AttendanceMaxPeriod1 float64 `json:"attendanceMaxPeriod1"`
	AttendanceMaxPeriod2 float64 `json:"attendanceMaxPeriod2"`
}

// UpdateCourseAttendanceConfig updates course attendance max hours and recalculates evaluations
func UpdateCourseAttendanceConfig(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	user := middleware.GetCurrentUser(c)
	if IsRoundLocked(courseID, 3, user) {
		return c.Status(403).JSON(fiber.Map{
			"error": "ไม่สามารถแก้ไขการตั้งค่าเวลาเรียนได้ เนื่องจากระยะที่ 3 (ปลายภาค) ส่งตรวจแล้วและถูกล็อกการแก้ไข",
		})
	}

	var input UpdateCourseAttendanceConfigInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if input.AttendanceMaxPeriod1 < 0 || input.AttendanceMaxPeriod2 < 0 || (input.AttendanceMaxPeriod1+input.AttendanceMaxPeriod2) <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "เวลาเรียนเต็มต้องมากกว่า 0 ชม."})
	}

	var course models.Course
	if err := database.DB.Where("id = ?", courseID).First(&course).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Course not found"})
	}

	course.AttendanceMaxPeriod1 = input.AttendanceMaxPeriod1
	course.AttendanceMaxPeriod2 = input.AttendanceMaxPeriod2
	database.DB.Save(&course)

	// Recalculate evaluations for all enrollments in this course
	var enrollments []models.CourseEnrollment
	database.DB.Preload("Evaluation").Where("course_id = ?", courseID).Find(&enrollments)

	tx := database.DB.Begin()
	for _, en := range enrollments {
		if en.Evaluation != nil {
			eval := en.Evaluation
			pct, isMs := CalculateAttendancePercentage(
				eval.AttendanceHoursPeriod1,
				eval.AttendanceHoursPeriod2,
				course.AttendanceMaxPeriod1,
				course.AttendanceMaxPeriod2,
			)
			eval.AttendanceHours = int(math.Round(eval.AttendanceHoursPeriod1 + eval.AttendanceHoursPeriod2))
			eval.AttendancePercentage = pct
			if isMs {
				eval.SpecialGrade = "มส"
				eval.Grade = "0"
			} else if eval.SpecialGrade == "มส" {
				eval.SpecialGrade = ""
				eval.Grade = CalculateStandardGrade(eval.TotalScore)
			}
			eval.UpdatedAt = time.Now()
			tx.Save(eval)
		}
	}
	tx.Commit()

	return c.JSON(fiber.Map{
		"message": "บันทึกการตั้งค่าเวลาเรียนเต็มสำเร็จ",
		"course":  course,
	})
}

// AutoCalculateEvaluations recalculates 3D evaluations for all students in course based on Admin Criteria
func AutoCalculateEvaluations(c *fiber.Ctx) error {
	id := c.Params("id")
	courseID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid course id"})
	}

	user := middleware.GetCurrentUser(c)
	if IsRoundLocked(courseID, 3, user) {
		return c.Status(403).JSON(fiber.Map{
			"error": "ไม่สามารถคำนวณการประเมิน 3 ด้านอัตโนมัติได้ เนื่องจากระยะที่ 3 (ปลายภาค) ส่งตรวจแล้วและถูกล็อกการแก้ไข",
		})
	}

	criteria := LoadCurrentAssessmentCriteria()

	query := database.DB.Preload("Evaluation").Where("course_id = ?", courseID)
	if roomID := c.Query("room_id"); roomID != "" && roomID != "ALL" {
		allowed, errMsg := CheckTeacherRoomPermission(courseID, user, roomID)
		if !allowed {
			return c.Status(403).JSON(fiber.Map{"error": errMsg})
		}
		query = query.Where("room_id = ?", roomID)
	} else if user != nil && !strings.EqualFold(user.Role, "ADMIN") && !strings.EqualFold(user.Role, "ACADEMIC") {
		var myAssignment models.CourseTeacher
		if err := database.DB.Where("course_id = ? AND user_id = ?", courseID, user.ID).First(&myAssignment).Error; err == nil {
			var teacherCount int64
			database.DB.Model(&models.CourseTeacher{}).Where("course_id = ?", courseID).Count(&teacherCount)
			if teacherCount > 1 {
				var assignedRooms []string
				if myAssignment.AssignedRooms != "" && myAssignment.AssignedRooms != "[]" {
					_ = json.Unmarshal([]byte(myAssignment.AssignedRooms), &assignedRooms)
				}
				if len(assignedRooms) > 0 {
					query = query.Where("room_id IN (?)", assignedRooms)
				}
			}
		}
	}

	var enrollments []models.CourseEnrollment
	if err := query.Find(&enrollments).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch enrollments: " + err.Error()})
	}

	tx := database.DB.Begin()
	count := 0

	for _, en := range enrollments {
		var eval models.StudentEvaluation
		isNew := false
		if en.Evaluation != nil {
			eval = *en.Evaluation
		} else {
			isNew = true
			eval = models.StudentEvaluation{
				ID:                   uuid.New(),
				EnrollmentID:         en.ID,
				AttendancePercentage: 100.0,
				Grade:                "0",
			}
		}

		desirableLevel := MapGradeToAspectLevel(eval.Grade, eval.SpecialGrade, criteria.Desirable, criteria.SpecialGradeRules)
		readingLevel := MapGradeToAspectLevel(eval.Grade, eval.SpecialGrade, criteria.Reading, criteria.SpecialGradeRules)
		competencyLevel := MapGradeToAspectLevel(eval.Grade, eval.SpecialGrade, criteria.Competency, criteria.SpecialGradeRules)

		eval.DesirableGrade = desirableLevel
		eval.DesirableSubscores = GenerateDesirableSubscoresArray(desirableLevel)

		eval.ReadingGrade = readingLevel
		eval.ReadingSubscores = GenerateSubscoresArray(5, readingLevel)

		eval.CompetencyGrade = competencyLevel
		eval.CompetencySubscores = GenerateSubscoresArray(5, competencyLevel)

		eval.IsOverridden = false
		eval.UpdatedAt = time.Now()

		if isNew {
			tx.Create(&eval)
		} else {
			tx.Save(&eval)
		}
		count++
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to auto-calculate evaluations: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("คำนวณการประเมิน 3 ด้านอัตโนมัติสำเร็จ %d คน (ตามเกณฑ์ของโรงเรียน)", count),
	})
}
