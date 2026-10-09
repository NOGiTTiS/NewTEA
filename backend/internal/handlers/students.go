package handlers

import (
	"fmt"
	"strings"
	"time"

	"newtea-backend/internal/database"
	"newtea-backend/internal/middleware"
	"newtea-backend/internal/models"
	"newtea-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

// GetStudents returns list of students filtered by room, grade, status or query
func GetStudents(c *fiber.Ctx) error {
	roomID := c.Query("room_id")
	gradeLevel := c.QueryInt("grade_level")
	status := c.Query("status")
	search := strings.TrimSpace(c.Query("search"))

	query := database.DB.Model(&models.Student{}).Preload("Room")

	if roomID != "" {
		query = query.Where("students.room_id = ?", roomID)
	} else if gradeLevel > 0 {
		query = query.Joins("JOIN rooms ON rooms.id = students.room_id").Where("rooms.grade_level = ?", gradeLevel)
	}

	if status != "" {
		query = query.Where("students.status = ?", status)
	}

	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("students.student_code ILIKE ? OR students.first_name ILIKE ? OR students.last_name ILIKE ? OR students.elective_group ILIKE ? OR students.language_group ILIKE ?",
			searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
	}

	var students []models.Student
	if err := query.Order("SPLIT_PART(students.room_id, '.', 1)::int asc, SPLIT_PART(students.room_id, '.', 2)::int asc, students.seat_no asc").Find(&students).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch students: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"total":    len(students),
		"students": students,
	})
}

// GetStudentByID retrieves student and their audit history
func GetStudentByID(c *fiber.Ctx) error {
	id := c.Params("id")
	var student models.Student

	query := database.DB.Preload("Room")
	if uid, err := uuid.Parse(id); err == nil {
		query = query.Where("id = ? OR student_code = ?", uid, id)
	} else {
		query = query.Where("student_code = ?", id)
	}

	if err := query.First(&student).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Student not found"})
	}

	var logs []models.StudentAuditLog
	database.DB.Where("student_id = ?", student.StudentCode).Order("changed_at desc").Find(&logs)

	return c.JSON(fiber.Map{
		"student": student,
		"logs":    logs,
	})
}

type UpdateStudentStatusInput struct {
	Status        string `json:"status"`        // ACTIVE, TRANSFERRED, RESIGNED, SUSPENDED
	RoomID        string `json:"roomId"`        // e.g. "4.1"
	SeatNo        *int   `json:"seatNo"`
	LanguageGroup string `json:"languageGroup"` // เกาหลี, ฝรั่งเศส, ญี่ปุ่น, จีน
	ElectiveGroup string `json:"electiveGroup"` // ทัศนศิลป์, ฟุตบอล, ฯลฯ
	Reason        string `json:"reason"`        // เหตุผลการแก้ไข
}

// UpdateStudentStatus updates room/status/groups with audit logging
func UpdateStudentStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	var input UpdateStudentStatusInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var student models.Student
	query := database.DB
	if uid, err := uuid.Parse(id); err == nil {
		query = query.Where("id = ? OR student_code = ?", uid, id)
	} else {
		query = query.Where("student_code = ?", id)
	}

	if err := query.First(&student).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Student not found"})
	}

	user := middleware.GetCurrentUser(c)
	changedBy := "admin"
	if user != nil {
		changedBy = fmt.Sprintf("%s (%s)", user.Name, user.Email)
	}

	// Track changes
	var logsToCreate []models.StudentAuditLog

	if input.Status != "" && input.Status != student.Status {
		logsToCreate = append(logsToCreate, models.StudentAuditLog{
			ID:        uuid.New(),
			StudentID: student.StudentCode,
			Action:    "STATUS_CHANGE",
			OldValue:  student.Status,
			NewValue:  fmt.Sprintf("%s (เหตุผล: %s)", input.Status, input.Reason),
			ChangedBy: changedBy,
			ChangedAt: time.Now(),
		})
		student.Status = input.Status
	}

	if input.RoomID != "" && input.RoomID != student.RoomID {
		logsToCreate = append(logsToCreate, models.StudentAuditLog{
			ID:        uuid.New(),
			StudentID: student.StudentCode,
			Action:    "ROOM_CHANGE",
			OldValue:  student.RoomID,
			NewValue:  fmt.Sprintf("%s (เหตุผล: %s)", input.RoomID, input.Reason),
			ChangedBy: changedBy,
			ChangedAt: time.Now(),
		})
		student.RoomID = input.RoomID
	}

	if input.SeatNo != nil && *input.SeatNo != student.SeatNo {
		student.SeatNo = *input.SeatNo
	}

	if input.LanguageGroup != "" && input.LanguageGroup != student.LanguageGroup {
		logsToCreate = append(logsToCreate, models.StudentAuditLog{
			ID:        uuid.New(),
			StudentID: student.StudentCode,
			Action:    "LANG_CHANGE",
			OldValue:  student.LanguageGroup,
			NewValue:  fmt.Sprintf("%s (เหตุผล: %s)", input.LanguageGroup, input.Reason),
			ChangedBy: changedBy,
			ChangedAt: time.Now(),
		})
		student.LanguageGroup = input.LanguageGroup
	}

	if input.ElectiveGroup != "" && input.ElectiveGroup != student.ElectiveGroup {
		logsToCreate = append(logsToCreate, models.StudentAuditLog{
			ID:        uuid.New(),
			StudentID: student.StudentCode,
			Action:    "ELECTIVE_CHANGE",
			OldValue:  student.ElectiveGroup,
			NewValue:  fmt.Sprintf("%s (เหตุผล: %s)", input.ElectiveGroup, input.Reason),
			ChangedBy: changedBy,
			ChangedAt: time.Now(),
		})
		student.ElectiveGroup = input.ElectiveGroup
	}

	if err := database.DB.Save(&student).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update student: " + err.Error()})
	}

	for _, log := range logsToCreate {
		database.DB.Create(&log)
	}

	return c.JSON(fiber.Map{
		"message": "Student updated successfully",
		"student": student,
	})
}

// ImportStudents handles multipart file upload of Excel/CSV students
func ImportStudents(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Please provide an Excel or CSV file"})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to open uploaded file"})
	}
	defer file.Close()

	result, err := services.ParseAndImportStudents(file, fileHeader.Filename)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("Imported successfully: %d processed, %d created, %d updated",
			result.TotalProcessed, result.CreatedCount, result.UpdatedCount),
		"result": result,
	})
}

// ImportAdvisors handles multipart file upload of Excel/CSV advisors
func ImportAdvisors(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Please provide an Excel or CSV file"})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to open uploaded file"})
	}
	defer file.Close()

	result, err := services.ParseAndImportAdvisors(file, fileHeader.Filename)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("Advisors imported successfully: %d processed, %d mapped",
			result.TotalProcessed, result.CreatedCount),
		"result": result,
	})
}

// GetStudentTemplate returns CSV template for students with UTF-8 BOM
func GetStudentTemplate(c *fiber.Ctx) error {
	// Prepend UTF-8 BOM so Microsoft Excel on Windows opens Thai text correctly
	csvContent := "\xef\xbb\xbfstudent_id,national_id,prefix,first_name,last_name,room,seat_no,language_group,elective_group,status\n" +
		"50001,1234567890123,นาย,สมชาย,ใจดี,4.1,1,ญี่ปุ่น,,ACTIVE\n" +
		"50002,1234567890124,นางสาว,สมหญิง,รักเรียน,4.13,1,ฝรั่งเศส,ฟุตบอล,ACTIVE\n"

	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", "attachment; filename=students_template.csv")
	return c.SendString(csvContent)
}

// GetStudentTemplateXlsx generates native Excel (.xlsx) template
func GetStudentTemplateXlsx(c *fiber.Ctx) error {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Students"
	f.SetSheetName("Sheet1", sheet)

	headers := []string{"student_id", "national_id", "prefix", "first_name", "last_name", "room", "seat_no", "language_group", "elective_group", "status"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	// Sample rows
	f.SetCellValue(sheet, "A2", "50001")
	f.SetCellValue(sheet, "B2", "1234567890123")
	f.SetCellValue(sheet, "C2", "นาย")
	f.SetCellValue(sheet, "D2", "สมชาย")
	f.SetCellValue(sheet, "E2", "ใจดี")
	f.SetCellValue(sheet, "F2", "4.1")
	f.SetCellValue(sheet, "G2", 1)
	f.SetCellValue(sheet, "H2", "ญี่ปุ่น")
	f.SetCellValue(sheet, "I2", "")
	f.SetCellValue(sheet, "J2", "ACTIVE")

	f.SetCellValue(sheet, "A3", "50002")
	f.SetCellValue(sheet, "B3", "1234567890124")
	f.SetCellValue(sheet, "C3", "นางสาว")
	f.SetCellValue(sheet, "D3", "สมหญิง")
	f.SetCellValue(sheet, "E3", "รักเรียน")
	f.SetCellValue(sheet, "F3", "4.13")
	f.SetCellValue(sheet, "G3", 1)
	f.SetCellValue(sheet, "H3", "ฝรั่งเศส")
	f.SetCellValue(sheet, "I3", "ฟุตบอล")
	f.SetCellValue(sheet, "J3", "ACTIVE")

	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", "attachment; filename=students_template.xlsx")
	return f.Write(c.Response().BodyWriter())
}

// GetAdvisorTemplate returns CSV template for advisors (TUNorth format) with UTF-8 BOM
func GetAdvisorTemplate(c *fiber.Ctx) error {
	// Prepend UTF-8 BOM so Microsoft Excel on Windows opens Thai text correctly
	csvContent := "\xef\xbb\xbfห้อง,ชื่อครูที่ปรึกษาคนที่ 1,ห้อง,ชื่อครูที่ปรึกษาคนที่ 2,ห้อง,ชื่อครูที่ปรึกษาคนที่ 3\n" +
		"4.1,นางประภาพรรณ คำรังษี,4.1,นางสาวศุภมาส จ้อยเชื้อ,4.1,\n" +
		"4.2,นางสาวอนุรักษ์ สุขเหมือน,4.2,นายชญานิน พลอินต๊ะ,4.2,\n"

	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", "attachment; filename=advisors_template.csv")
	return c.SendString(csvContent)
}

// GetAdvisorTemplateXlsx generates native Excel (.xlsx) template for advisors
func GetAdvisorTemplateXlsx(c *fiber.Ctx) error {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Advisors"
	f.SetSheetName("Sheet1", sheet)

	headers := []string{"ห้อง", "ชื่อครูที่ปรึกษาคนที่ 1", "ห้อง", "ชื่อครูที่ปรึกษาคนที่ 2", "ห้อง", "ชื่อครูที่ปรึกษาคนที่ 3"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	f.SetCellValue(sheet, "A2", "4.1")
	f.SetCellValue(sheet, "B2", "นางประภาพรรณ คำรังษี")
	f.SetCellValue(sheet, "C2", "4.1")
	f.SetCellValue(sheet, "D2", "นางสาวศุภมาส จ้อยเชื้อ")
	f.SetCellValue(sheet, "E2", "4.1")
	f.SetCellValue(sheet, "F2", "")

	f.SetCellValue(sheet, "A3", "4.2")
	f.SetCellValue(sheet, "B3", "นางสาวอนุรักษ์ สุขเหมือน")
	f.SetCellValue(sheet, "C3", "4.2")
	f.SetCellValue(sheet, "D3", "นายชญานิน พลอินต๊ะ")
	f.SetCellValue(sheet, "E3", "4.2")
	f.SetCellValue(sheet, "F3", "")

	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", "attachment; filename=advisors_template.xlsx")
	return f.Write(c.Response().BodyWriter())
}

// CreateStudentInput represents individual student creation payload
type CreateStudentInput struct {
	StudentCode   string `json:"studentId"`
	NationalID    string `json:"nationalId"`
	Prefix        string `json:"prefix"`
	FirstName     string `json:"firstName"`
	LastName      string `json:"lastName"`
	RoomID        string `json:"roomId"`
	SeatNo        int    `json:"seatNo"`
	LanguageGroup string `json:"languageGroup"`
	ElectiveGroup string `json:"electiveGroup"`
	Status        string `json:"status"`
}

// CreateStudent adds a single student to the system
func CreateStudent(c *fiber.Ctx) error {
	var input CreateStudentInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	input.StudentCode = strings.TrimSpace(input.StudentCode)
	input.FirstName = strings.TrimSpace(input.FirstName)
	input.LastName = strings.TrimSpace(input.LastName)
	input.RoomID = strings.TrimSpace(input.RoomID)

	if input.StudentCode == "" || input.FirstName == "" || input.LastName == "" || input.RoomID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณากรอกรหัสนักเรียน, ชื่อ, นามสกุล และห้องเรียน"})
	}

	// Verify room exists
	var room models.Room
	if err := database.DB.Where("id = ?", input.RoomID).First(&room).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("ไม่พบห้องเรียน %s ในระบบ", input.RoomID)})
	}

	// Check duplicate student_code
	var existing models.Student
	if err := database.DB.Where("student_code = ?", input.StudentCode).First(&existing).Error; err == nil {
		return c.Status(409).JSON(fiber.Map{"error": fmt.Sprintf("รหัสนักเรียน %s มีอยู่ในระบบแล้ว", input.StudentCode)})
	}

	// Default status
	status := strings.ToUpper(strings.TrimSpace(input.Status))
	if status == "" {
		status = "ACTIVE"
	}

	// Auto assign seat_no if not provided
	seatNo := input.SeatNo
	if seatNo <= 0 {
		var maxSeat struct{ Max int }
		database.DB.Model(&models.Student{}).Where("room_id = ?", input.RoomID).Select("COALESCE(MAX(seat_no), 0) as max").Scan(&maxSeat)
		seatNo = maxSeat.Max + 1
	}

	student := models.Student{
		ID:            uuid.New(),
		StudentCode:   input.StudentCode,
		NationalID:    strings.TrimSpace(input.NationalID),
		Prefix:        strings.TrimSpace(input.Prefix),
		FirstName:     input.FirstName,
		LastName:      input.LastName,
		RoomID:        input.RoomID,
		SeatNo:        seatNo,
		LanguageGroup: strings.TrimSpace(input.LanguageGroup),
		ElectiveGroup: strings.TrimSpace(input.ElectiveGroup),
		Status:        status,
	}

	if err := database.DB.Create(&student).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create student: " + err.Error()})
	}

	user := middleware.GetCurrentUser(c)
	changedBy := "admin"
	if user != nil {
		changedBy = fmt.Sprintf("%s (%s)", user.Name, user.Email)
	}

	// Audit Log
	database.DB.Create(&models.StudentAuditLog{
		ID:        uuid.New(),
		StudentID: student.StudentCode,
		Action:    "CREATE_STUDENT",
		OldValue:  "-",
		NewValue:  fmt.Sprintf("สร้างนักเรียนใหม่: %s %s %s (ห้อง %s เลขที่ %d)", student.Prefix, student.FirstName, student.LastName, student.RoomID, student.SeatNo),
		ChangedBy: changedBy,
		ChangedAt: time.Now(),
	})

	return c.Status(201).JSON(fiber.Map{
		"message": "เพิ่มข้อมูลนักเรียนสำเร็จ",
		"student": student,
	})
}

// UpdateStudent modifies an existing student's details
func UpdateStudent(c *fiber.Ctx) error {
	id := c.Params("id")
	var input CreateStudentInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var student models.Student
	query := database.DB
	if uid, err := uuid.Parse(id); err == nil {
		query = query.Where("id = ? OR student_code = ?", uid, id)
	} else {
		query = query.Where("student_code = ?", id)
	}

	if err := query.First(&student).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบข้อมูลนักเรียน"})
	}

	user := middleware.GetCurrentUser(c)
	changedBy := "admin"
	if user != nil {
		changedBy = fmt.Sprintf("%s (%s)", user.Name, user.Email)
	}

	var logs []models.StudentAuditLog

	if input.RoomID != "" && input.RoomID != student.RoomID {
		logs = append(logs, models.StudentAuditLog{
			ID:        uuid.New(),
			StudentID: student.StudentCode,
			Action:    "ROOM_CHANGE",
			OldValue:  student.RoomID,
			NewValue:  input.RoomID,
			ChangedBy: changedBy,
			ChangedAt: time.Now(),
		})
		student.RoomID = input.RoomID
	}

	if input.SeatNo > 0 && input.SeatNo != student.SeatNo {
		student.SeatNo = input.SeatNo
	}

	if input.Status != "" && input.Status != student.Status {
		logs = append(logs, models.StudentAuditLog{
			ID:        uuid.New(),
			StudentID: student.StudentCode,
			Action:    "STATUS_CHANGE",
			OldValue:  student.Status,
			NewValue:  input.Status,
			ChangedBy: changedBy,
			ChangedAt: time.Now(),
		})
		student.Status = input.Status
	}

	if input.LanguageGroup != student.LanguageGroup {
		logs = append(logs, models.StudentAuditLog{
			ID:        uuid.New(),
			StudentID: student.StudentCode,
			Action:    "LANG_CHANGE",
			OldValue:  student.LanguageGroup,
			NewValue:  input.LanguageGroup,
			ChangedBy: changedBy,
			ChangedAt: time.Now(),
		})
		student.LanguageGroup = input.LanguageGroup
	}

	if input.ElectiveGroup != student.ElectiveGroup {
		student.ElectiveGroup = input.ElectiveGroup
	}

	if input.FirstName != "" {
		student.FirstName = input.FirstName
	}
	if input.LastName != "" {
		student.LastName = input.LastName
	}
	if input.Prefix != "" {
		student.Prefix = input.Prefix
	}
	if input.NationalID != "" {
		student.NationalID = input.NationalID
	}

	if err := database.DB.Save(&student).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update student: " + err.Error()})
	}

	if len(logs) > 0 {
		database.DB.Create(&logs)
	}

	return c.JSON(fiber.Map{
		"message": "แก้ไขข้อมูลนักเรียนสำเร็จ",
		"student": student,
	})
}

// DeleteStudent removes a student and logs the event
func DeleteStudent(c *fiber.Ctx) error {
	id := c.Params("id")
	var student models.Student
	query := database.DB
	if uid, err := uuid.Parse(id); err == nil {
		query = query.Where("id = ? OR student_code = ?", uid, id)
	} else {
		query = query.Where("student_code = ?", id)
	}

	if err := query.First(&student).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบข้อมูลนักเรียน"})
	}

	user := middleware.GetCurrentUser(c)
	changedBy := "admin"
	if user != nil {
		changedBy = fmt.Sprintf("%s (%s)", user.Name, user.Email)
	}

	// Audit Log
	database.DB.Create(&models.StudentAuditLog{
		ID:        uuid.New(),
		StudentID: student.StudentCode,
		Action:    "DELETE_STUDENT",
		OldValue:  fmt.Sprintf("%s %s %s (ห้อง %s)", student.Prefix, student.FirstName, student.LastName, student.RoomID),
		NewValue:  "ลบข้อมูลนักเรียนออกจากระบบ",
		ChangedBy: changedBy,
		ChangedAt: time.Now(),
	})

	if err := database.DB.Delete(&student).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete student: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "ลบข้อมูลนักเรียนสำเร็จ",
	})
}

// BulkDeleteStudentsInput defines request payload for bulk student deletion
type BulkDeleteStudentsInput struct {
	StudentIDs []string `json:"studentIds"`
	Reason     string   `json:"reason"`
}

// BulkDeleteStudents deletes multiple students by IDs with cascade cleanup
func BulkDeleteStudents(c *fiber.Ctx) error {
	var input BulkDeleteStudentsInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if len(input.StudentIDs) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาเลือกนักเรียนที่ต้องการลบอย่างน้อย 1 คน"})
	}

	user := middleware.GetCurrentUser(c)
	changedBy := "admin"
	if user != nil {
		changedBy = fmt.Sprintf("%s (%s)", user.Name, user.Email)
	}

	reason := input.Reason
	if reason == "" {
		reason = "ลบข้อมูลนักเรียนแบบกลุ่ม"
	}

	tx := database.DB.Begin()

	var uuids []uuid.UUID
	var codes []string
	for _, idStr := range input.StudentIDs {
		if u, err := uuid.Parse(idStr); err == nil {
			uuids = append(uuids, u)
		} else {
			codes = append(codes, idStr)
		}
	}

	var students []models.Student
	q := tx.Model(&models.Student{})
	if len(uuids) > 0 && len(codes) > 0 {
		q = q.Where("id IN (?) OR student_code IN (?)", uuids, codes)
	} else if len(uuids) > 0 {
		q = q.Where("id IN (?)", uuids)
	} else {
		q = q.Where("student_code IN (?)", codes)
	}

	if err := q.Find(&students).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to query students: " + err.Error()})
	}

	if len(students) == 0 {
		tx.Rollback()
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบข้อมูลนักเรียนที่ต้องการลบ"})
	}

	targetStudentUUIDs := make([]uuid.UUID, len(students))
	targetStudentCodes := make([]string, len(students))
	for i, s := range students {
		targetStudentUUIDs[i] = s.ID
		targetStudentCodes[i] = s.StudentCode
	}

	// Cascade delete
	tx.Exec("DELETE FROM student_audit_logs WHERE student_id IN (?)", targetStudentCodes)
	tx.Exec("DELETE FROM student_scores WHERE enrollment_id IN (SELECT id FROM course_enrollments WHERE student_id IN (?))", targetStudentUUIDs)
	tx.Exec("DELETE FROM student_evaluations WHERE enrollment_id IN (SELECT id FROM course_enrollments WHERE student_id IN (?))", targetStudentUUIDs)
	tx.Exec("DELETE FROM course_enrollments WHERE student_id IN (?)", targetStudentUUIDs)

	if err := tx.Where("id IN (?)", targetStudentUUIDs).Delete(&models.Student{}).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete students: " + err.Error()})
	}

	tx.Create(&models.StudentAuditLog{
		ID:        uuid.New(),
		StudentID: "BULK_DELETE",
		Action:    "BULK_DELETE_STUDENTS",
		OldValue:  fmt.Sprintf("จำนวน %d คน", len(students)),
		NewValue:  fmt.Sprintf("ลบข้อมูลนักเรียนแบบกลุ่ม (เหตุผล: %s)", reason),
		ChangedBy: changedBy,
		ChangedAt: time.Now(),
	})

	if err := tx.Commit().Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Transaction commit failed: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":      fmt.Sprintf("ลบข้อมูลนักเรียนสำเร็จ %d คน", len(students)),
		"deletedCount": len(students),
	})
}

// DeleteStudentsByScopeInput defines payload for deleting by room, grade, or all
type DeleteStudentsByScopeInput struct {
	Scope  string `json:"scope"`  // "ALL", "GRADE", "ROOM"
	Target string `json:"target"` // e.g. "6", "4.13" or ""
	Reason string `json:"reason"`
}

// DeleteStudentsByScope removes students by room, grade or entire roster
func DeleteStudentsByScope(c *fiber.Ctx) error {
	var input DeleteStudentsByScopeInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	user := middleware.GetCurrentUser(c)
	changedBy := "admin"
	if user != nil {
		changedBy = fmt.Sprintf("%s (%s)", user.Name, user.Email)
	}

	reason := input.Reason
	if reason == "" {
		reason = "ลบข้อมูลตามขอบเขต"
	}

	tx := database.DB.Begin()

	var students []models.Student
	q := tx.Model(&models.Student{})

	switch input.Scope {
	case "ALL":
		// Delete all students
	case "GRADE":
		if input.Target == "" {
			tx.Rollback()
			return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุระดับชั้น (4, 5, หรือ 6)"})
		}
		q = q.Where("room_id LIKE ?", input.Target+".%")
	case "ROOM":
		if input.Target == "" {
			tx.Rollback()
			return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุห้องเรียน (เช่น 4.1)"})
		}
		q = q.Where("room_id = ?", input.Target)
	default:
		tx.Rollback()
		return c.Status(400).JSON(fiber.Map{"error": "ขอบเขตไม่ถูกต้อง (ต้องเป็น ALL, GRADE หรือ ROOM)"})
	}

	if err := q.Find(&students).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to query students: " + err.Error()})
	}

	if len(students) == 0 {
		tx.Rollback()
		return c.JSON(fiber.Map{
			"message":      "ไม่พบนักเรียนในขอบเขตที่เลือก",
			"deletedCount": 0,
		})
	}

	targetStudentUUIDs := make([]uuid.UUID, len(students))
	targetStudentCodes := make([]string, len(students))
	for i, s := range students {
		targetStudentUUIDs[i] = s.ID
		targetStudentCodes[i] = s.StudentCode
	}

	// Cascade delete
	tx.Exec("DELETE FROM student_audit_logs WHERE student_id IN (?)", targetStudentCodes)
	tx.Exec("DELETE FROM student_scores WHERE enrollment_id IN (SELECT id FROM course_enrollments WHERE student_id IN (?))", targetStudentUUIDs)
	tx.Exec("DELETE FROM student_evaluations WHERE enrollment_id IN (SELECT id FROM course_enrollments WHERE student_id IN (?))", targetStudentUUIDs)
	tx.Exec("DELETE FROM course_enrollments WHERE student_id IN (?)", targetStudentUUIDs)

	if err := tx.Where("id IN (?)", targetStudentUUIDs).Delete(&models.Student{}).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete students: " + err.Error()})
	}

	scopeDesc := "ทั้งหมดในระบบ"
	if input.Scope == "GRADE" {
		scopeDesc = fmt.Sprintf("ระดับชั้น ม.%s", input.Target)
	} else if input.Scope == "ROOM" {
		scopeDesc = fmt.Sprintf("ห้อง ม.%s", input.Target)
	}

	tx.Create(&models.StudentAuditLog{
		ID:        uuid.New(),
		StudentID: "SCOPE_DELETE",
		Action:    "DELETE_BY_SCOPE",
		OldValue:  fmt.Sprintf("%s (%d คน)", scopeDesc, len(students)),
		NewValue:  fmt.Sprintf("ล้างข้อมูลนักเรียนตามขอบเขต (เหตุผล: %s)", reason),
		ChangedBy: changedBy,
		ChangedAt: time.Now(),
	})

	if err := tx.Commit().Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Transaction commit failed: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":      fmt.Sprintf("ล้างข้อมูลนักเรียน%s สำเร็จเรียบร้อยแล้ว (%d คน)", scopeDesc, len(students)),
		"deletedCount": len(students),
	})
}

type CreateAdvisorInput struct {
	RoomID       string `json:"roomId"`       // e.g. "4.1"
	AdvisorOrder int    `json:"advisorOrder"` // 1, 2, 3
	Name         string `json:"name"`         // Name of teacher
	Email        string `json:"email"`        // Optional email
	UserID       string `json:"userId"`       // Optional existing user id
}

// GetRoomAdvisors lists all room advisors grouped by room along with rooms and teachers
func GetRoomAdvisors(c *fiber.Ctx) error {
	var advisors []models.RoomAdvisor
	if err := database.DB.Preload("Room").Preload("User").Order("SPLIT_PART(room_id, '.', 1)::int asc, SPLIT_PART(room_id, '.', 2)::int asc, advisor_order asc").Find(&advisors).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch room advisors: " + err.Error()})
	}

	// Also list all 45 rooms
	var rooms []models.Room
	database.DB.Order("grade_level asc, room_number asc").Find(&rooms)

	// Also list all registered users with TEACHER or ADVISOR role
	var teachers []models.User
	database.DB.Order("name asc").Find(&teachers)

	// Group by room_id
	type AdvisorDTO struct {
		ID     string `json:"id"`
		Order  int    `json:"order"`
		Name   string `json:"name"`
		Email  string `json:"email"`
		UserID string `json:"userId"`
	}
	grouped := make(map[string][]AdvisorDTO)
	for _, a := range advisors {
		grouped[a.RoomID] = append(grouped[a.RoomID], AdvisorDTO{
			ID:     a.ID.String(),
			Order:  a.AdvisorOrder,
			Name:   a.User.Name,
			Email:  a.User.Email,
			UserID: a.UserID,
		})
	}

	return c.JSON(fiber.Map{
		"advisors":       advisors,
		"advisorsByRoom": grouped,
		"rooms":          rooms,
		"teachers":       teachers,
	})
}

// CreateOrAssignAdvisor assigns an advisory teacher to a room (up to 3 advisors per room)
func CreateOrAssignAdvisor(c *fiber.Ctx) error {
	var input CreateAdvisorInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	input.RoomID = strings.TrimSpace(input.RoomID)
	input.Name = strings.TrimSpace(input.Name)
	input.Email = strings.TrimSpace(input.Email)

	if input.RoomID == "" || input.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุห้องเรียนและชื่อครูที่ปรึกษา"})
	}

	if input.AdvisorOrder < 1 || input.AdvisorOrder > 3 {
		input.AdvisorOrder = 1
	}

	// Verify room exists
	var room models.Room
	if err := database.DB.Where("id = ?", input.RoomID).First(&room).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ไม่พบห้องเรียน " + input.RoomID})
	}

	// Find or create User
	var user models.User
	if input.UserID != "" {
		database.DB.Where("id = ?", input.UserID).First(&user)
	}
	if user.ID == "" && input.Email != "" {
		database.DB.Where("email = ?", input.Email).First(&user)
	}
	if user.ID == "" {
		database.DB.Where("name = ?", input.Name).First(&user)
	}
	if user.ID == "" {
		// Create new teacher user
		email := input.Email
		if email == "" {
			email = fmt.Sprintf("teacher_%s@tn.ac.th", uuid.New().String()[:8])
		}
		user = models.User{
			ID:    uuid.New().String(),
			Name:  input.Name,
			Email: email,
			Role:  "TEACHER",
		}
		database.DB.Create(&user)
	} else if input.Name != "" && user.Name != input.Name {
		user.Name = input.Name
		database.DB.Save(&user)
	}

	// Check if this room already has an advisor with this order
	var existing models.RoomAdvisor
	if err := database.DB.Where("room_id = ? AND advisor_order = ?", input.RoomID, input.AdvisorOrder).First(&existing).Error; err == nil {
		// Update existing assignment
		existing.UserID = user.ID
		database.DB.Save(&existing)
		database.DB.Preload("Room").Preload("User").First(&existing, existing.ID)
		return c.JSON(fiber.Map{
			"message": "อัปเดตข้อมูลครูที่ปรึกษาสำเร็จ",
			"advisor": existing,
		})
	}

	// Create new RoomAdvisor assignment
	advisor := models.RoomAdvisor{
		ID:           uuid.New(),
		RoomID:       input.RoomID,
		UserID:       user.ID,
		AdvisorOrder: input.AdvisorOrder,
	}
	if err := database.DB.Create(&advisor).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create advisor: " + err.Error()})
	}

	database.DB.Preload("Room").Preload("User").First(&advisor, advisor.ID)

	return c.Status(201).JSON(fiber.Map{
		"message": "เพิ่มครูที่ปรึกษาประจำห้องสำเร็จ",
		"advisor": advisor,
	})
}

// UpdateAdvisor updates an existing room advisor assignment
func UpdateAdvisor(c *fiber.Ctx) error {
	id := c.Params("id")
	advID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid advisor id"})
	}

	var input CreateAdvisorInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var advisor models.RoomAdvisor
	if err := database.DB.Preload("User").Where("id = ?", advID).First(&advisor).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบข้อมูลครูที่ปรึกษา"})
	}

	if input.RoomID != "" {
		advisor.RoomID = input.RoomID
	}
	if input.AdvisorOrder >= 1 && input.AdvisorOrder <= 3 {
		advisor.AdvisorOrder = input.AdvisorOrder
	}

	if input.Name != "" {
		advisor.User.Name = input.Name
		if input.Email != "" {
			advisor.User.Email = input.Email
		}
		database.DB.Save(&advisor.User)
	}

	if err := database.DB.Save(&advisor).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update advisor: " + err.Error()})
	}

	database.DB.Preload("Room").Preload("User").First(&advisor, advisor.ID)

	return c.JSON(fiber.Map{
		"message": "แก้ไขข้อมูลครูที่ปรึกษาสำเร็จ",
		"advisor": advisor,
	})
}

// DeleteAdvisor removes an advisor from a room
func DeleteAdvisor(c *fiber.Ctx) error {
	id := c.Params("id")
	advID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid advisor id"})
	}

	if err := database.DB.Where("id = ?", advID).Delete(&models.RoomAdvisor{}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete advisor"})
	}

	return c.JSON(fiber.Map{
		"message": "ลบครูที่ปรึกษาออกจากห้องเรียนสำเร็จ",
	})
}
