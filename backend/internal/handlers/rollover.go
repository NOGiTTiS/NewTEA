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

// RolloverPreviewResponse provides statistics for year-end rollover
type RolloverPreviewResponse struct {
	M6ActiveCount     int64    `json:"m6ActiveCount"`
	M5ActiveCount     int64    `json:"m5ActiveCount"`
	M4ActiveCount     int64    `json:"m4ActiveCount"`
	GraduatedCount    int64    `json:"graduatedCount"`
	OtherStatusCount  int64    `json:"otherStatusCount"`
	ActiveM6Rooms     []string `json:"activeM6Rooms"`
	CanPromote        bool     `json:"canPromote"`
	PromoteBlockReason string   `json:"promoteBlockReason,omitempty"`
}

// GetRolloverPreview calculates the counts of students in each level
func GetRolloverPreview(c *fiber.Ctx) error {
	var m6Count int64
	database.DB.Model(&models.Student{}).
		Where("room_id LIKE '6.%' AND status = 'ACTIVE'").
		Count(&m6Count)

	var m5Count int64
	database.DB.Model(&models.Student{}).
		Where("room_id LIKE '5.%' AND status = 'ACTIVE'").
		Count(&m5Count)

	var m4Count int64
	database.DB.Model(&models.Student{}).
		Where("room_id LIKE '4.%' AND status = 'ACTIVE'").
		Count(&m4Count)

	var graduatedCount int64
	database.DB.Model(&models.Student{}).
		Where("status = 'GRADUATED'").
		Count(&graduatedCount)

	var otherCount int64
	database.DB.Model(&models.Student{}).
		Where("status IN ('TRANSFERRED', 'RESIGNED', 'SUSPENDED')").
		Count(&otherCount)

	// Distinct rooms having active M.6 students
	var activeM6Rooms []string
	database.DB.Model(&models.Student{}).
		Where("room_id LIKE '6.%' AND status = 'ACTIVE'").
		Distinct("room_id").
		Order("SPLIT_PART(room_id, '.', 2)::int asc").
		Pluck("room_id", &activeM6Rooms)

	canPromote := m6Count == 0
	promoteBlockReason := ""
	if m6Count > 0 {
		promoteBlockReason = fmt.Sprintf("ยังมีนักเรียน ม.6 จำนวน %d คน ในห้องเรียนปกติ กรุณาดำเนินการอนุมัติจบการศึกษาก่อนทำการเลื่อนชั้น", m6Count)
	}

	return c.JSON(RolloverPreviewResponse{
		M6ActiveCount:      m6Count,
		M5ActiveCount:      m5Count,
		M4ActiveCount:      m4Count,
		GraduatedCount:     graduatedCount,
		OtherStatusCount:   otherCount,
		ActiveM6Rooms:      activeM6Rooms,
		CanPromote:         canPromote,
		PromoteBlockReason: promoteBlockReason,
	})
}

// GraduateM6Request allows graduating all or specific rooms
type GraduateM6Request struct {
	RoomIDs []string `json:"roomIds,omitempty"` // If empty, graduates all active students in 6.1-6.15
	Reason  string   `json:"reason,omitempty"`
}

// GraduateM6Students updates active students in M.6 to GRADUATED
func GraduateM6Students(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	changedBy := "Admin"
	if user != nil {
		changedBy = fmt.Sprintf("%s (%s)", user.Name, user.Email)
	}

	var req GraduateM6Request
	if err := c.BodyParser(&req); err != nil {
		// Empty body is acceptable (defaults to all M.6)
		req = GraduateM6Request{}
	}

	var studentsToGraduate []models.Student
	query := database.DB.Model(&models.Student{}).Where("room_id LIKE '6.%' AND status = 'ACTIVE'")
	if len(req.RoomIDs) > 0 {
		query = query.Where("room_id IN (?)", req.RoomIDs)
	}

	if err := query.Find(&studentsToGraduate).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch M.6 students: " + err.Error()})
	}

	if len(studentsToGraduate) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "ไม่พบนักเรียน ม.6 ที่มีสถานะปกติ (ACTIVE) ที่ต้องจบการศึกษา"})
	}

	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		reason = "จบการศึกษาตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน"
	}

	// Run in transaction
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		var studentCodes []string

		for _, s := range studentsToGraduate {
			studentCodes = append(studentCodes, s.StudentCode)
			auditLog := models.StudentAuditLog{
				ID:        uuid.New(),
				StudentID: s.StudentCode,
				Action:    "GRADUATION",
				OldValue:  fmt.Sprintf("ห้อง %s (ACTIVE)", s.RoomID),
				NewValue:  fmt.Sprintf("จบการศึกษา (GRADUATED) - %s", reason),
				ChangedBy: changedBy,
				ChangedAt: now,
			}
			if err := tx.Create(&auditLog).Error; err != nil {
				return err
			}
		}

		// Bulk update status to GRADUATED
		if err := tx.Model(&models.Student{}).
			Where("student_code IN (?)", studentCodes).
			Update("status", "GRADUATED").Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "บันทึกการจบการศึกษาไม่สำเร็จ: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":        fmt.Sprintf("อนุมัติจบการศึกษานักเรียน ม.6 เรียบร้อยแล้ว จำนวน %d คน", len(studentsToGraduate)),
		"graduatedCount": len(studentsToGraduate),
	})
}

// PromoteStudentsRequest optional parameters for promotion
type PromoteStudentsRequest struct {
	SkipConfirmation bool   `json:"skipConfirmation,omitempty"`
	Reason           string `json:"reason,omitempty"`
}

// PromoteStudents promotes M.5 to M.6, and M.4 to M.5 in a safe two-phase transaction
func PromoteStudents(c *fiber.Ctx) error {
	user := middleware.GetCurrentUser(c)
	changedBy := "Admin"
	if user != nil {
		changedBy = fmt.Sprintf("%s (%s)", user.Name, user.Email)
	}

	// 1. Safety check: make sure no active M.6 students remain in room 6.x
	var activeM6Count int64
	database.DB.Model(&models.Student{}).
		Where("room_id LIKE '6.%' AND status = 'ACTIVE'").
		Count(&activeM6Count)

	if activeM6Count > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("ไม่สามารถเลื่อนชั้นได้เนื่องจากยังมีนักเรียน ม.6 จำนวน %d คน ค้างอยู่ในห้องเรียน กรุณาอนุมัติจบการศึกษา ม.6 ก่อน", activeM6Count),
		})
	}

	// 2. Fetch active M.5 students
	var m5Students []models.Student
	if err := database.DB.Where("room_id LIKE '5.%' AND status = 'ACTIVE'").Find(&m5Students).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch M.5 students: " + err.Error()})
	}

	// 3. Fetch active M.4 students
	var m4Students []models.Student
	if err := database.DB.Where("room_id LIKE '4.%' AND status = 'ACTIVE'").Find(&m4Students).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch M.4 students: " + err.Error()})
	}

	if len(m5Students) == 0 && len(m4Students) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "ไม่พบนักเรียน ม.4 หรือ ม.5 ที่มีสถานะปกติ (ACTIVE) สำหรับเลื่อนชั้น"})
	}

	// 4. Execute atomic transaction
	promotedM5Count := 0
	promotedM4Count := 0

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now()

		// Phase 1: Promote M.5 -> M.6
		for _, s := range m5Students {
			// Room "5.1" -> "6.1", "5.15" -> "6.15"
			roomParts := strings.Split(s.RoomID, ".")
			if len(roomParts) == 2 && roomParts[0] == "5" {
				newRoomID := "6." + roomParts[1]
				auditLog := models.StudentAuditLog{
					ID:        uuid.New(),
					StudentID: s.StudentCode,
					Action:    "PROMOTION",
					OldValue:  s.RoomID,
					NewValue:  fmt.Sprintf("%s (เลื่อนชั้นปีการศึกษา)", newRoomID),
					ChangedBy: changedBy,
					ChangedAt: now,
				}
				if err := tx.Create(&auditLog).Error; err != nil {
					return err
				}

				if err := tx.Model(&models.Student{}).
					Where("student_code = ?", s.StudentCode).
					Update("room_id", newRoomID).Error; err != nil {
					return err
				}
				promotedM5Count++
			}
		}

		// Phase 2: Promote M.4 -> M.5
		for _, s := range m4Students {
			// Room "4.1" -> "5.1", "4.15" -> "5.15"
			roomParts := strings.Split(s.RoomID, ".")
			if len(roomParts) == 2 && roomParts[0] == "4" {
				newRoomID := "5." + roomParts[1]
				auditLog := models.StudentAuditLog{
					ID:        uuid.New(),
					StudentID: s.StudentCode,
					Action:    "PROMOTION",
					OldValue:  s.RoomID,
					NewValue:  fmt.Sprintf("%s (เลื่อนชั้นปีการศึกษา)", newRoomID),
					ChangedBy: changedBy,
					ChangedAt: now,
				}
				if err := tx.Create(&auditLog).Error; err != nil {
					return err
				}

				if err := tx.Model(&models.Student{}).
					Where("student_code = ?", s.StudentCode).
					Update("room_id", newRoomID).Error; err != nil {
					return err
				}
				promotedM4Count++
			}
		}

		return nil
	})

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "เลื่อนชั้นปีการศึกษาไม่สำเร็จ: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("เลื่อนชั้นปีการศึกษาสำเร็จ: ม.5 ขึ้น ม.6 จำนวน %d คน และ ม.4 ขึ้น ม.5 จำนวน %d คน (ห้อง 4.1 - 4.15 พร้อมรับนักเรียนใหม่)", promotedM5Count, promotedM4Count),
		"promotedM5toM6Count": promotedM5Count,
		"promotedM4toM5Count": promotedM4Count,
		"totalPromoted":       promotedM5Count + promotedM4Count,
	})
}
