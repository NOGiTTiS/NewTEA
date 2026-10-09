package handlers

import (
	"fmt"
	"strings"
	"time"

	"newtea-backend/internal/database"
	"newtea-backend/internal/middleware"
	"newtea-backend/internal/models"
	"newtea-backend/internal/services"
	"newtea-backend/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

// ValidRoles lists supported roles in NewTEA
var ValidRoles = []string{"ADMIN", "ACADEMIC", "DEPT_HEAD", "TEACHER", "ADVISOR"}

// GetMe returns current authenticated user and their advisor assignments
func GetMe(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
		})
	}

	// Check if this user is an advisor of any room
	var advisorRecords []models.RoomAdvisor
	database.DB.Where("user_id = ?", user.ID).Find(&advisorRecords)
	var advisorRooms []string
	for _, a := range advisorRecords {
		advisorRooms = append(advisorRooms, a.RoomID)
	}

	var adminCount int64
	database.DB.Model(&models.User{}).Where("role = ?", "ADMIN").Count(&adminCount)

	return c.JSON(fiber.Map{
		"user":         user,
		"isAdvisor":    len(advisorRooms) > 0 || user.Role == "ADVISOR",
		"advisorRooms": advisorRooms,
		"adminCount":   adminCount,
	})
}

// GetUsers lists all users with filtering and role stats (ADMIN only)
func GetUsers(c *fiber.Ctx) error {
	search := strings.TrimSpace(c.Query("search"))
	role := strings.TrimSpace(c.Query("role"))
	dept := strings.TrimSpace(c.Query("department"))

	query := database.DB.Model(&models.User{})

	if search != "" {
		pattern := "%" + search + "%"
		query = query.Where("name ILIKE ? OR email ILIKE ?", pattern, pattern)
	}

	if role != "" {
		query = query.Where("role = ?", strings.ToUpper(role))
	}

	if dept != "" {
		query = query.Where("department = ?", dept)
	}

	var users []models.User
	if err := query.Order("role asc, name asc").Find(&users).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch users: " + err.Error()})
	}

	// Map advisor rooms for each user
	var advisorRecords []models.RoomAdvisor
	database.DB.Order("room_id asc, advisor_order asc").Find(&advisorRecords)
	advisorRoomsByUser := make(map[string][]string)
	for _, a := range advisorRecords {
		advisorRoomsByUser[a.UserID] = append(advisorRoomsByUser[a.UserID], a.RoomID)
	}

	type UserDTO struct {
		models.User
		AdvisorRooms []string `json:"advisorRooms"`
	}

	userDTOs := make([]UserDTO, len(users))
	for i, u := range users {
		rooms := advisorRoomsByUser[u.ID]
		if rooms == nil {
			rooms = []string{}
		}
		userDTOs[i] = UserDTO{
			User:         u,
			AdvisorRooms: rooms,
		}
	}

	// Role counts summary
	var roleCounts []struct {
		Role  string `json:"role"`
		Count int64  `json:"count"`
	}
	database.DB.Model(&models.User{}).Select("role, count(*) as count").Group("role").Scan(&roleCounts)

	stats := make(map[string]int64)
	for _, rc := range roleCounts {
		stats[rc.Role] = rc.Count
	}

	return c.JSON(fiber.Map{
		"users":      userDTOs,
		"total":      len(users),
		"roleStats":  stats,
		"adminCount": stats["ADMIN"],
	})
}

// CreateUserInput payload for creating a new user
type CreateUserInput struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	Role       string `json:"role"`
	Department string `json:"department"`
	Password   string `json:"password"`
}

// CreateUser creates a new teacher or administrative user (ADMIN only)
func CreateUser(c *fiber.Ctx) error {
	var input CreateUserInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	input.Name = strings.TrimSpace(input.Name)
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	input.Department = strings.TrimSpace(input.Department)
	input.Role = strings.ToUpper(strings.TrimSpace(input.Role))
	input.Password = strings.TrimSpace(input.Password)

	if input.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุชื่อ-นามสกุล"})
	}
	if input.Email == "" || !strings.Contains(input.Email, "@") {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุอีเมลที่ถูกต้อง"})
	}

	if input.Role == "" {
		input.Role = "TEACHER"
	}
	isValidRole := false
	for _, r := range ValidRoles {
		if r == input.Role {
			isValidRole = true
			break
		}
	}
	if !isValidRole {
		return c.Status(400).JSON(fiber.Map{"error": "บทบาทผู้ใช้ไม่ถูกต้อง"})
	}

	if input.Password == "" {
		input.Password = "Tunorth@2026"
	}
	if len(input.Password) < 8 {
		return c.Status(400).JSON(fiber.Map{"error": "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร"})
	}

	// Check email uniqueness
	var count int64
	database.DB.Model(&models.User{}).Where("email ILIKE ?", input.Email).Count(&count)
	if count > 0 {
		return c.Status(400).JSON(fiber.Map{"error": "อีเมลนี้มีอยู่ในระบบแล้ว กรุณาใช้อีเมลอื่น"})
	}

	now := time.Now()
	newUserID := uuid.New().String()
	newUser := models.User{
		ID:            newUserID,
		Name:          input.Name,
		Email:         input.Email,
		Role:          input.Role,
		Department:    input.Department,
		EmailVerified: true,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := database.DB.Create(&newUser).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create user: " + err.Error()})
	}

	// Create Better Auth credential account
	hash, err := utils.HashPassword(input.Password)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to hash password: " + err.Error()})
	}

	account := models.Account{
		ID:         uuid.New().String(),
		UserID:     newUserID,
		AccountID:  newUserID,
		ProviderID: "credential",
		Password:   hash,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := database.DB.Create(&account).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create user credential account: " + err.Error()})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "สร้างผู้ใช้งานสำเร็จเรียบร้อยแล้ว",
		"user":    newUser,
	})
}

// UpdateUserInput payload for updating user details
type UpdateUserInput struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	Role       string `json:"role"`
	Department string `json:"department"`
}

// UpdateUser modifies user information (ADMIN only)
func UpdateUser(c *fiber.Ctx) error {
	id := c.Params("id")
	var input UpdateUserInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	input.Name = strings.TrimSpace(input.Name)
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	input.Department = strings.TrimSpace(input.Department)
	input.Role = strings.ToUpper(strings.TrimSpace(input.Role))

	if input.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุชื่อ-นามสกุล"})
	}
	if input.Email == "" || !strings.Contains(input.Email, "@") {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุอีเมลที่ถูกต้อง"})
	}

	isValidRole := false
	for _, r := range ValidRoles {
		if r == input.Role {
			isValidRole = true
			break
		}
	}
	if !isValidRole {
		return c.Status(400).JSON(fiber.Map{"error": "บทบาทผู้ใช้ไม่ถูกต้อง"})
	}

	var user models.User
	if err := database.DB.Where("id = ?", id).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบบัญชีผู้ใช้ในระบบ"})
	}

	// Safety check: Prevent demoting the last ADMIN
	if user.Role == "ADMIN" && input.Role != "ADMIN" {
		var adminCount int64
		database.DB.Model(&models.User{}).Where("role = ?", "ADMIN").Count(&adminCount)
		if adminCount <= 1 {
			return c.Status(400).JSON(fiber.Map{
				"error": "ไม่สามารถเปลี่ยนสิทธิ์ผู้ดูแลระบบคนสุดท้ายได้ ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน",
			})
		}
	}

	// Check email uniqueness if email changed
	if user.Email != input.Email {
		var count int64
		database.DB.Model(&models.User{}).Where("email ILIKE ? AND id != ?", input.Email, id).Count(&count)
		if count > 0 {
			return c.Status(400).JSON(fiber.Map{"error": "อีเมลนี้มีผู้ใช้งานอื่นใช้อยู่แล้ว"})
		}
	}

	user.Name = input.Name
	user.Email = input.Email
	user.Role = input.Role
	user.Department = input.Department
	user.UpdatedAt = time.Now()

	if err := database.DB.Save(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update user: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "อัปเดตข้อมูลผู้ใช้เรียบร้อยแล้ว",
		"user":    user,
	})
}

// DeleteUser removes a user and their associated credentials (ADMIN only)
func DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")

	var user models.User
	if err := database.DB.Where("id = ?", id).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบบัญชีผู้ใช้ในระบบ"})
	}

	// Safeguard 1: Cannot delete self
	currentUser := middleware.GetCurrentUser(c)
	if currentUser != nil && currentUser.ID == id {
		return c.Status(400).JSON(fiber.Map{"error": "ไม่สามารถลบบัญชีของตนเองที่กำลังเข้าสู่ระบบอยู่ได้"})
	}

	// Safeguard 2: Cannot delete last ADMIN
	if user.Role == "ADMIN" {
		var adminCount int64
		database.DB.Model(&models.User{}).Where("role = ?", "ADMIN").Count(&adminCount)
		if adminCount <= 1 {
			return c.Status(400).JSON(fiber.Map{"error": "ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้"})
		}
	}

	// Clean up associated records in transaction
	tx := database.DB.Begin()
	if err := tx.Where("user_id = ?", id).Delete(&models.Session{}).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete user sessions: " + err.Error()})
	}
	if err := tx.Where("user_id = ?", id).Delete(&models.Account{}).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete user accounts: " + err.Error()})
	}
	if err := tx.Where("user_id = ?", id).Delete(&models.RoomAdvisor{}).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete user advisor records: " + err.Error()})
	}
	if err := tx.Where("user_id = ?", id).Delete(&models.CourseTeacher{}).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete user course teacher assignments: " + err.Error()})
	}
	if err := tx.Where("id = ?", id).Delete(&models.User{}).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete user: " + err.Error()})
	}
	tx.Commit()

	return c.JSON(fiber.Map{
		"message": "ลบบัญชีผู้ใช้เรียบร้อยแล้ว",
	})
}

// ResetPasswordInput payload
type ResetPasswordInput struct {
	Password string `json:"password"`
}

// ResetUserPassword updates or sets a new password for a user (ADMIN only)
func ResetUserPassword(c *fiber.Ctx) error {
	id := c.Params("id")
	var input ResetPasswordInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	input.Password = strings.TrimSpace(input.Password)
	if len(input.Password) < 8 {
		return c.Status(400).JSON(fiber.Map{"error": "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร"})
	}

	var user models.User
	if err := database.DB.Where("id = ?", id).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบบัญชีผู้ใช้ในระบบ"})
	}

	hash, err := utils.HashPassword(input.Password)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to hash password: " + err.Error()})
	}

	var account models.Account
	err = database.DB.Where("user_id = ? AND provider_id = ?", id, "credential").First(&account).Error
	now := time.Now()
	if err != nil {
		// Create new credential account if didn't exist (e.g. was Google only)
		account = models.Account{
			ID:         uuid.New().String(),
			UserID:     id,
			AccountID:  id,
			ProviderID: "credential",
			Password:   hash,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if err := database.DB.Create(&account).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create account password: " + err.Error()})
		}
	} else {
		// Update existing password
		account.Password = hash
		account.UpdatedAt = now
		if err := database.DB.Save(&account).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update account password: " + err.Error()})
		}
	}

	return c.JSON(fiber.Map{
		"message": "รีเซ็ตรหัสผ่านสำหรับ " + user.Name + " เรียบร้อยแล้ว",
	})
}

// UpdateUserRoleInput payload
type UpdateUserRoleInput struct {
	Role string `json:"role"`
}

// UpdateUserRole changes a user's role (ADMIN only)
func UpdateUserRole(c *fiber.Ctx) error {
	id := c.Params("id")
	var input UpdateUserRoleInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	input.Role = strings.ToUpper(strings.TrimSpace(input.Role))
	isValid := false
	for _, r := range ValidRoles {
		if r == input.Role {
			isValid = true
			break
		}
	}
	if !isValid {
		return c.Status(400).JSON(fiber.Map{
			"error":      "Invalid role. Supported roles: ADMIN, ACADEMIC, DEPT_HEAD, TEACHER, ADVISOR",
			"validRoles": ValidRoles,
		})
	}

	var user models.User
	if err := database.DB.Where("id = ?", id).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// Safety check: Prevent demoting the last ADMIN
	if user.Role == "ADMIN" && input.Role != "ADMIN" {
		var adminCount int64
		database.DB.Model(&models.User{}).Where("role = ?", "ADMIN").Count(&adminCount)
		if adminCount <= 1 {
			return c.Status(400).JSON(fiber.Map{
				"error": "ไม่สามารถเปลี่ยนสิทธิ์ผู้ดูแลระบบคนสุดท้ายได้ ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน",
			})
		}
	}

	user.Role = input.Role
	user.UpdatedAt = time.Now()
	if err := database.DB.Save(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update user role: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "อัปเดตสิทธิ์ผู้ใช้เรียบร้อยแล้ว",
		"user":    user,
	})
}

// UpdateUserDeptInput payload
type UpdateUserDeptInput struct {
	Department string `json:"department"`
}

// UpdateUserDepartment updates user's learning group department (ADMIN only)
func UpdateUserDepartment(c *fiber.Ctx) error {
	id := c.Params("id")
	var input UpdateUserDeptInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var user models.User
	if err := database.DB.Where("id = ?", id).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	user.Department = strings.TrimSpace(input.Department)
	user.UpdatedAt = time.Now()
	if err := database.DB.Save(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update department: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "อัปเดตกลุ่มสาระการเรียนรู้เรียบร้อยแล้ว",
		"user":    user,
	})
}

// SetupFirstAdminInput payload
type SetupFirstAdminInput struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
}

// SetupFirstAdmin boots the first administrator if no admin exists in the system
func SetupFirstAdmin(c *fiber.Ctx) error {
	var adminCount int64
	database.DB.Model(&models.User{}).Where("role = ?", "ADMIN").Count(&adminCount)

	// If admin already exists, caller must be an ADMIN
	currentUser := middleware.GetCurrentUser(c)
	if adminCount > 0 {
		if currentUser == nil || currentUser.Role != "ADMIN" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "มีผู้ดูแลระบบในระบบแล้ว การตั้งค่าผู้ดูแลเพิ่มเติมต้องทำโดยผู้ดูแลระบบเท่านั้น",
			})
		}
	}

	var input SetupFirstAdminInput
	_ = c.BodyParser(&input)

	input.Email = strings.TrimSpace(input.Email)
	input.UserID = strings.TrimSpace(input.UserID)

	if input.Email == "" && input.UserID == "" && currentUser != nil {
		input.Email = currentUser.Email
		input.UserID = currentUser.ID
	}

	if input.Email == "" && input.UserID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุอีเมลหรือรหัสผู้ใช้ที่ต้องการแต่งตั้งเป็นผู้ดูแลระบบ"})
	}

	var targetUser models.User
	var err error
	if input.UserID != "" {
		err = database.DB.Where("id = ?", input.UserID).First(&targetUser).Error
	} else {
		err = database.DB.Where("email ILIKE ?", input.Email).First(&targetUser).Error
	}

	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบบัญชีผู้ใช้ที่ระบุในระบบ"})
	}

	targetUser.Role = "ADMIN"
	targetUser.UpdatedAt = time.Now()
	if err := database.DB.Save(&targetUser).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to promote user to ADMIN: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "แต่งตั้งผู้ดูแลระบบ (ADMIN) สำเร็จเรียบร้อยแล้ว",
		"user":    targetUser,
	})
}

// ImportUsers handles multipart file upload of Excel/CSV users
func ImportUsers(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Please provide an Excel or CSV file"})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to open uploaded file"})
	}
	defer file.Close()

	result, err := services.ParseAndImportUsers(file, fileHeader.Filename)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("นำเข้าข้อมูลผู้ใช้สำเร็จ: ดำเนินการ %d รายการ, เพิ่มใหม่ %d คน, อัปเดต %d คน",
			result.TotalProcessed, result.CreatedCount, result.UpdatedCount),
		"result": result,
	})
}

// GetUserTemplate returns CSV template for users with UTF-8 BOM
func GetUserTemplate(c *fiber.Ctx) error {
	// Prepend UTF-8 BOM so Microsoft Excel on Windows opens Thai text correctly
	csvContent := "\xef\xbb\xbfname,email,department,role,password\n" +
		"สมชาย ใจดี,somchai.j@tn.ac.th,กลุ่มสาระการเรียนรู้คณิตศาสตร์,TEACHER,Tunorth@2026\n" +
		"สมหญิง รักเรียน,somying.r@tn.ac.th,กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี,DEPT_HEAD,Tunorth@2026\n" +
		"แอดมิน ระบบ,admin.sys@tn.ac.th,,ADMIN,Tunorth@2026\n"

	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", "attachment; filename=users_template.csv")
	return c.SendString(csvContent)
}

// GetUserTemplateXlsx generates native Excel (.xlsx) template for users
func GetUserTemplateXlsx(c *fiber.Ctx) error {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Users"
	f.SetSheetName("Sheet1", sheet)

	headers := []string{"name", "email", "department", "role", "password"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	f.SetCellValue(sheet, "A2", "สมชาย ใจดี")
	f.SetCellValue(sheet, "B2", "somchai.j@tn.ac.th")
	f.SetCellValue(sheet, "C2", "กลุ่มสาระการเรียนรู้คณิตศาสตร์")
	f.SetCellValue(sheet, "D2", "TEACHER")
	f.SetCellValue(sheet, "E2", "Tunorth@2026")

	f.SetCellValue(sheet, "A3", "สมหญิง รักเรียน")
	f.SetCellValue(sheet, "B3", "somying.r@tn.ac.th")
	f.SetCellValue(sheet, "C3", "กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี")
	f.SetCellValue(sheet, "D3", "DEPT_HEAD")
	f.SetCellValue(sheet, "E3", "Tunorth@2026")

	f.SetCellValue(sheet, "A4", "แอดมิน ระบบ")
	f.SetCellValue(sheet, "B4", "admin.sys@tn.ac.th")
	f.SetCellValue(sheet, "C4", "")
	f.SetCellValue(sheet, "D4", "ADMIN")
	f.SetCellValue(sheet, "E4", "Tunorth@2026")

	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", "attachment; filename=users_template.xlsx")
	return f.Write(c.Response().BodyWriter())
}

