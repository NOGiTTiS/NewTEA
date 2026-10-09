package handlers

import (
	"fmt"
	"time"

	"newtea-backend/internal/database"
	"newtea-backend/internal/middleware"
	"newtea-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GetAcademicTerms returns all terms and the currently active one
func GetAcademicTerms(c *fiber.Ctx) error {
	var terms []models.AcademicTerm
	if err := database.DB.Order("year desc, semester desc").Find(&terms).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch terms"})
	}

	return c.JSON(fiber.Map{
		"terms": terms,
	})
}

type CreateTermInput struct {
	Year      int    `json:"year"`     // 2568, 2569
	Semester  int    `json:"semester"` // 1, 2
	IsActive  bool   `json:"isActive"`
	StartDate string `json:"startDate"` // YYYY-MM-DD
	EndDate   string `json:"endDate"`   // YYYY-MM-DD
}

// CreateAcademicTerm creates a new semester and automatically seeds the 3 standard verification milestones
func CreateAcademicTerm(c *fiber.Ctx) error {
	var input CreateTermInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	start, _ := time.Parse("2006-01-02", input.StartDate)
	end, _ := time.Parse("2006-01-02", input.EndDate)
	if start.IsZero() {
		start = time.Now()
	}
	if end.IsZero() {
		end = time.Now().AddDate(0, 5, 0)
	}

	term := models.AcademicTerm{
		ID:        uuid.New(),
		Year:      input.Year,
		Semester:  input.Semester,
		IsActive:  input.IsActive,
		StartDate: start,
		EndDate:   end,
	}

	if input.IsActive {
		database.DB.Model(&models.AcademicTerm{}).Where("is_active = ?", true).Update("is_active", false)
	}

	if err := database.DB.Create(&term).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create academic term: " + err.Error()})
	}

	// Seed 3 standard verification rounds for this term
	milestones := []models.VerificationMilestone{
		{
			ID:               uuid.New(),
			TermID:           term.ID,
			Round:            1,
			Title:            "ตรวจครั้งที่ 1 (ก่อนกลางภาค)",
			TeacherDeadline:  start.AddDate(0, 1, 15),
			AcademicDeadline: start.AddDate(0, 1, 22),
		},
		{
			ID:               uuid.New(),
			TermID:           term.ID,
			Round:            2,
			Title:            "ตรวจครั้งที่ 2 (กลางภาค)",
			TeacherDeadline:  start.AddDate(0, 2, 20),
			AcademicDeadline: start.AddDate(0, 2, 27),
		},
		{
			ID:               uuid.New(),
			TermID:           term.ID,
			Round:            3,
			Title:            "ตรวจครั้งที่ 3 (หลังกลางภาค/ปลายภาค) + ส่ง SGS",
			TeacherDeadline:  end.AddDate(0, 0, -10),
			AcademicDeadline: end,
		},
	}
	database.DB.Create(&milestones)

	return c.JSON(fiber.Map{
		"message": "Academic term created successfully",
		"term":    term,
	})
}

// ActivateAcademicTerm sets a term as active and others as inactive
func ActivateAcademicTerm(c *fiber.Ctx) error {
	id := c.Params("id")
	termID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid term id"})
	}

	database.DB.Model(&models.AcademicTerm{}).Where("is_active = ?", true).Update("is_active", false)
	if err := database.DB.Model(&models.AcademicTerm{}).Where("id = ?", termID).Update("is_active", true).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to activate term"})
	}

	return c.JSON(fiber.Map{"message": "Academic term activated successfully"})
}

// UpdateAcademicTerm updates year, semester, dates, or active status
func UpdateAcademicTerm(c *fiber.Ctx) error {
	id := c.Params("id")
	termID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid term id"})
	}

	var input CreateTermInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var term models.AcademicTerm
	if err := database.DB.Where("id = ?", termID).First(&term).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบข้อมูลปีการศึกษา"})
	}

	if input.Year > 0 {
		term.Year = input.Year
	}
	if input.Semester > 0 {
		term.Semester = input.Semester
	}

	if input.StartDate != "" {
		if start, err := time.Parse("2006-01-02", input.StartDate); err == nil {
			term.StartDate = start
		}
	}
	if input.EndDate != "" {
		if end, err := time.Parse("2006-01-02", input.EndDate); err == nil {
			term.EndDate = end
		}
	}

	if input.IsActive && !term.IsActive {
		database.DB.Model(&models.AcademicTerm{}).Where("is_active = ?", true).Update("is_active", false)
		term.IsActive = true
	} else if !input.IsActive && term.IsActive {
		term.IsActive = false
	}

	if err := database.DB.Save(&term).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update academic term: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "แก้ไขข้อมูลปีการศึกษาสำเร็จ",
		"term":    term,
	})
}

// DeleteAcademicTerm deletes an academic term and cascade deletes its milestones
func DeleteAcademicTerm(c *fiber.Ctx) error {
	id := c.Params("id")
	termID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid term id"})
	}

	var term models.AcademicTerm
	if err := database.DB.Where("id = ?", termID).First(&term).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบข้อมูลปีการศึกษา"})
	}

	// Check if any courses are bound to this term
	var courseCount int64
	database.DB.Model(&models.Course{}).Where("term_id = ?", termID).Count(&courseCount)
	if courseCount > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("ไม่สามารถลบปีการศึกษานี้ได้ เนื่องจากมีรายวิชาเปิดสอนอยู่ %d วิชา", courseCount),
		})
	}

	// Cascade delete milestones
	database.DB.Where("term_id = ?", termID).Delete(&models.VerificationMilestone{})

	if err := database.DB.Delete(&term).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete term: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "ลบปีการศึกษาสำเร็จ",
	})
}

// GetMilestones returns the verification milestones for a term
func GetMilestones(c *fiber.Ctx) error {
	id := c.Params("id")
	termID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid term id"})
	}

	var milestones []models.VerificationMilestone
	database.DB.Where("term_id = ?", termID).Order("round asc").Find(&milestones)

	return c.JSON(fiber.Map{
		"milestones": milestones,
	})
}

type UpdateMilestonesInput struct {
	Milestones []struct {
		ID               string `json:"id"`
		Round            int    `json:"round"`
		Title            string `json:"title"`
		TeacherDeadline  string `json:"teacherDeadline"`
		AcademicDeadline string `json:"academicDeadline"`
	} `json:"milestones"`
}

// UpdateMilestones saves updated dates for verification rounds
func UpdateMilestones(c *fiber.Ctx) error {
	id := c.Params("id")
	termID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid term id"})
	}

	var input UpdateMilestonesInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	for _, item := range input.Milestones {
		tDeadline, _ := time.Parse("2006-01-02", item.TeacherDeadline)
		aDeadline, _ := time.Parse("2006-01-02", item.AcademicDeadline)

		var ms models.VerificationMilestone
		if item.ID != "" {
			mid, _ := uuid.Parse(item.ID)
			database.DB.Where("id = ?", mid).First(&ms)
		} else {
			database.DB.Where("term_id = ? AND round = ?", termID, item.Round).First(&ms)
		}

		if ms.ID != uuid.Nil {
			ms.Title = item.Title
			if !tDeadline.IsZero() {
				ms.TeacherDeadline = tDeadline
			}
			if !aDeadline.IsZero() {
				ms.AcademicDeadline = aDeadline
			}
			database.DB.Save(&ms)
		}
	}

	var updated []models.VerificationMilestone
	database.DB.Where("term_id = ?", termID).Order("round asc").Find(&updated)

	return c.JSON(fiber.Map{
		"message":    "บันทึกกำหนดการตรวจสำเร็จ",
		"milestones": updated,
	})
}

type CreateMilestoneInput struct {
	Round            int    `json:"round"`
	Title            string `json:"title"`
	TeacherDeadline  string `json:"teacherDeadline"`
	AcademicDeadline string `json:"academicDeadline"`
}

// CreateMilestone adds a milestone to a term
func CreateMilestone(c *fiber.Ctx) error {
	id := c.Params("id")
	termID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid term id"})
	}

	var input CreateMilestoneInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	tDeadline, _ := time.Parse("2006-01-02", input.TeacherDeadline)
	aDeadline, _ := time.Parse("2006-01-02", input.AcademicDeadline)
	if tDeadline.IsZero() {
		tDeadline = time.Now().AddDate(0, 1, 0)
	}
	if aDeadline.IsZero() {
		aDeadline = tDeadline.AddDate(0, 0, 7)
	}

	if input.Round <= 0 {
		var maxRound struct{ Max int }
		database.DB.Model(&models.VerificationMilestone{}).Where("term_id = ?", termID).Select("COALESCE(MAX(round), 0) as max").Scan(&maxRound)
		input.Round = maxRound.Max + 1
	}

	ms := models.VerificationMilestone{
		ID:               uuid.New(),
		TermID:           termID,
		Round:            input.Round,
		Title:            input.Title,
		TeacherDeadline:  tDeadline,
		AcademicDeadline: aDeadline,
	}

	if err := database.DB.Create(&ms).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create milestone: " + err.Error()})
	}

	return c.Status(201).JSON(fiber.Map{
		"message":   "เพิ่มกำหนดการตรวจสำเร็จ",
		"milestone": ms,
	})
}

// DeleteMilestone deletes a single milestone
func DeleteMilestone(c *fiber.Ctx) error {
	milestoneIDStr := c.Params("milestoneId")
	milestoneID, err := uuid.Parse(milestoneIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid milestone id"})
	}

	if err := database.DB.Where("id = ?", milestoneID).Delete(&models.VerificationMilestone{}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete milestone"})
	}

	return c.JSON(fiber.Map{"message": "ลบกำหนดการตรวจสำเร็จ"})
}

// ResetMilestones regenerates standard 3 rounds for a term
func ResetMilestones(c *fiber.Ctx) error {
	id := c.Params("id")
	termID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid term id"})
	}

	var term models.AcademicTerm
	if err := database.DB.Where("id = ?", termID).First(&term).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบข้อมูลปีการศึกษา"})
	}

	// Delete existing milestones
	database.DB.Where("term_id = ?", termID).Delete(&models.VerificationMilestone{})

	start := term.StartDate
	end := term.EndDate
	if start.IsZero() {
		start = time.Now()
	}
	if end.IsZero() {
		end = start.AddDate(0, 5, 0)
	}

	milestones := []models.VerificationMilestone{
		{
			ID:               uuid.New(),
			TermID:           termID,
			Round:            1,
			Title:            "ตรวจครั้งที่ 1 (ก่อนกลางภาค)",
			TeacherDeadline:  start.AddDate(0, 1, 15),
			AcademicDeadline: start.AddDate(0, 1, 22),
		},
		{
			ID:               uuid.New(),
			TermID:           termID,
			Round:            2,
			Title:            "ตรวจครั้งที่ 2 (กลางภาค)",
			TeacherDeadline:  start.AddDate(0, 2, 20),
			AcademicDeadline: start.AddDate(0, 2, 27),
		},
		{
			ID:               uuid.New(),
			TermID:           termID,
			Round:            3,
			Title:            "ตรวจครั้งที่ 3 (หลังกลางภาค/ปลายภาค) + ส่ง SGS",
			TeacherDeadline:  end.AddDate(0, 0, -10),
			AcademicDeadline: end,
		},
	}
	database.DB.Create(&milestones)

	return c.JSON(fiber.Map{
		"message":    "รีเซ็ตเป็น 3 ระยะมาตรฐานสำเร็จ",
		"milestones": milestones,
	})
}

// GetAdvisorRooms returns rooms assigned to the logged-in advisory teacher and all 45 rooms
func GetAdvisorRooms(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)

	// Always get all 45 rooms ordered
	var allRooms []models.Room
	database.DB.Order("grade_level asc, room_number asc").Find(&allRooms)
	var allRoomIDs []string
	for _, r := range allRooms {
		allRoomIDs = append(allRoomIDs, r.ID)
	}

	var assignedRooms []string
	if user != nil && (user.Role == "ADMIN" || user.Role == "ACADEMIC") {
		// Admin/Academic can see all
		assignedRooms = allRoomIDs
	} else if user != nil {
		var advisors []models.RoomAdvisor
		database.DB.Where("user_id = ?", user.ID).Find(&advisors)
		for _, a := range advisors {
			assignedRooms = append(assignedRooms, a.RoomID)
		}
		if len(assignedRooms) == 0 {
			var advByName []models.RoomAdvisor
			database.DB.Joins("JOIN \"user\" ON \"user\".id = room_advisors.user_id").
				Where("\"user\".name = ?", user.Name).Find(&advByName)
			for _, a := range advByName {
				assignedRooms = append(assignedRooms, a.RoomID)
			}
		}
	}

	return c.JSON(fiber.Map{
		"rooms":         allRoomIDs, // Default to all 45 rooms so select is never empty
		"assignedRooms": assignedRooms,
		"allRooms":      allRoomIDs,
	})
}

// GetAdvisorRoomDashboard returns roster, attendance overview, and grade statistics for a room
func GetAdvisorRoomDashboard(c *fiber.Ctx) error {
	roomID := c.Params("roomId")

	var room models.Room
	if err := database.DB.Where("id = ?", roomID).First(&room).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Room not found"})
	}

	var advisors []models.RoomAdvisor
	database.DB.Preload("User").Where("room_id = ?", roomID).Order("advisor_order asc").Find(&advisors)

	var students []models.Student
	database.DB.Where("room_id = ?", roomID).Order("seat_no asc").Find(&students)

	// Summary statistics
	totalStudents := len(students)
	activeStudents := 0
	langGroups := make(map[string]int)
	electiveGroups := make(map[string]int)

	for _, s := range students {
		if s.Status == "ACTIVE" {
			activeStudents++
		}
		if s.LanguageGroup != "" {
			langGroups[s.LanguageGroup]++
		}
		if s.ElectiveGroup != "" {
			electiveGroups[s.ElectiveGroup]++
		}
	}

	return c.JSON(fiber.Map{
		"room":           room,
		"advisors":       advisors,
		"totalStudents":  totalStudents,
		"activeStudents": activeStudents,
		"languageGroups": langGroups,
		"electiveGroups": electiveGroups,
		"students":       students,
	})
}
