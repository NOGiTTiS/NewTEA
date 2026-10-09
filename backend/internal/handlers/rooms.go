package handlers

import (
	"fmt"
	"time"

	"newtea-backend/internal/database"
	"newtea-backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

type RoomWithStats struct {
	ID           string    `json:"id"`
	GradeLevel   int       `json:"gradeLevel"`
	RoomNumber   int       `json:"roomNumber"`
	StudentCount int64     `json:"studentCount"`
	AdvisorCount int64     `json:"advisorCount"`
	CreatedAt    time.Time `json:"createdAt"`
}

// GetRooms returns all rooms ordered by grade and room number with active student and advisor counts
func GetRooms(c *fiber.Ctx) error {
	var rooms []models.Room
	if err := database.DB.Order("grade_level asc, room_number asc").Find(&rooms).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to fetch rooms: " + err.Error(),
		})
	}

	// Calculate student count by room
	type CountResult struct {
		RoomID string `gorm:"column:room_id"`
		Count  int64  `gorm:"column:count"`
	}

	var studentCounts []CountResult
	database.DB.Model(&models.Student{}).
		Where("status = ?", "ACTIVE").
		Select("room_id, count(*) as count").
		Group("room_id").
		Scan(&studentCounts)

	studentMap := make(map[string]int64)
	for _, sc := range studentCounts {
		studentMap[sc.RoomID] = sc.Count
	}

	// Calculate advisor count by room
	var advisorCounts []CountResult
	database.DB.Model(&models.RoomAdvisor{}).
		Select("room_id, count(*) as count").
		Group("room_id").
		Scan(&advisorCounts)

	advisorMap := make(map[string]int64)
	for _, ac := range advisorCounts {
		advisorMap[ac.RoomID] = ac.Count
	}

	result := make([]RoomWithStats, len(rooms))
	for i, r := range rooms {
		result[i] = RoomWithStats{
			ID:           r.ID,
			GradeLevel:   r.GradeLevel,
			RoomNumber:   r.RoomNumber,
			StudentCount: studentMap[r.ID],
			AdvisorCount: advisorMap[r.ID],
			CreatedAt:    r.CreatedAt,
		}
	}

	return c.JSON(fiber.Map{
		"total": len(result),
		"rooms": result,
	})
}

type CreateRoomInput struct {
	GradeLevel int `json:"gradeLevel"` // 4, 5, 6
	RoomNumber int `json:"roomNumber"` // 1-99
}

// CreateRoom adds a new classroom to the school roster
func CreateRoom(c *fiber.Ctx) error {
	var input CreateRoomInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบข้อมูลที่ส่งมา"})
	}

	if input.GradeLevel < 4 || input.GradeLevel > 6 {
		return c.Status(400).JSON(fiber.Map{"error": "ระดับชั้นต้องเป็นมัธยมศึกษาปีที่ 4, 5 หรือ 6 เท่านั้น"})
	}

	if input.RoomNumber < 1 || input.RoomNumber > 99 {
		return c.Status(400).JSON(fiber.Map{"error": "เลขที่ห้องเรียนต้องอยู่ระหว่าง 1 ถึง 99"})
	}

	roomID := fmt.Sprintf("%d.%d", input.GradeLevel, input.RoomNumber)

	// Check duplication
	var existing models.Room
	if err := database.DB.Where("id = ?", roomID).First(&existing).Error; err == nil {
		return c.Status(409).JSON(fiber.Map{
			"error": fmt.Sprintf("ห้องเรียน ม.%s มีอยู่ในระบบแล้ว", roomID),
		})
	}

	room := models.Room{
		ID:         roomID,
		GradeLevel: input.GradeLevel,
		RoomNumber: input.RoomNumber,
	}

	if err := database.DB.Create(&room).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "Failed to create room: " + err.Error(),
		})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": fmt.Sprintf("เปิดห้องเรียน ม.%s สำเร็จ", roomID),
		"room":    room,
	})
}

// DeleteRoom removes a classroom if no active students or course enrollments exist
func DeleteRoom(c *fiber.Ctx) error {
	roomID := c.Params("id")
	if roomID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุรหัสห้องเรียนที่ต้องการลบ"})
	}

	var room models.Room
	if err := database.DB.Where("id = ?", roomID).First(&room).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": fmt.Sprintf("ไม่พบห้องเรียน %s ในระบบ", roomID)})
	}

	// Safety Guard 1: Active students currently in this room
	var studentCount int64
	database.DB.Model(&models.Student{}).Where("room_id = ?", roomID).Count(&studentCount)
	if studentCount > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("ไม่สามารถลบห้อง ม.%s ได้ เนื่องจากยังมีนักเรียนสังกัดอยู่ในห้องนี้จำนวน %d คน กรุณาย้ายนักเรียนไปยังห้องอื่นก่อน", roomID, studentCount),
		})
	}

	// Safety Guard 2: Course enrollments tied to this room
	var enrollmentCount int64
	database.DB.Model(&models.CourseEnrollment{}).Where("room_id = ?", roomID).Count(&enrollmentCount)
	if enrollmentCount > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("ไม่สามารถลบห้อง ม.%s ได้ เนื่องจากมีประวัติการเรียนในรายวิชาจำนวน %d รายการ เพื่อป้องกันการสูญเสียข้อมูลเกรดย้อนหลัง", roomID, enrollmentCount),
		})
	}

	// Clean up any advisory teacher assignments for this room
	database.DB.Where("room_id = ?", roomID).Delete(&models.RoomAdvisor{})

	// Delete room record
	if err := database.DB.Delete(&room).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete room: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("ลบห้องเรียน ม.%s ออกจากระบบสำเร็จ", roomID),
	})
}
