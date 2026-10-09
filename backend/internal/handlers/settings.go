package handlers

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"newtea-backend/internal/database"
	"newtea-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// AssessmentAspectCriteria defines threshold settings for an individual aspect
type AssessmentAspectCriteria struct {
	Name              string  `json:"name"`
	ItemCount         int     `json:"itemCount"`
	ExcellentMinGrade float64 `json:"excellentMinGrade"` // e.g. 2.0 (>= 2.0 -> Level 3)
	GoodMinGrade      float64 `json:"goodMinGrade"`      // e.g. 1.0 (>= 1.0 -> Level 2)
	PassMinGrade      float64 `json:"passMinGrade"`      // e.g. 0.0 (>= 0.0 -> Level 1)
	DefaultLevel      int     `json:"defaultLevel"`      // 3
}

// SpecialGradeCriteria defines mapping rules for special grades (มส, ร)
type SpecialGradeCriteria struct {
	MsLevel int `json:"msLevel"` // default 0
	RLevel  int `json:"rLevel"`  // default 0
}

// AssessmentCriteriaConfig holds the full system setting configuration
type AssessmentCriteriaConfig struct {
	Mode              string                   `json:"mode"` // GRADE_BASED
	Desirable         AssessmentAspectCriteria `json:"desirable"`
	Reading           AssessmentAspectCriteria `json:"reading"`
	Competency        AssessmentAspectCriteria `json:"competency"`
	SpecialGradeRules SpecialGradeCriteria     `json:"specialGradeRules"`
}

// GetDefaultAssessmentCriteria returns fallback configuration
func GetDefaultAssessmentCriteria() AssessmentCriteriaConfig {
	return AssessmentCriteriaConfig{
		Mode: "GRADE_BASED",
		Desirable: AssessmentAspectCriteria{
			Name:              "คุณลักษณะอันพึงประสงค์",
			ItemCount:         8,
			ExcellentMinGrade: 2.0,
			GoodMinGrade:      1.0,
			PassMinGrade:      0.0,
			DefaultLevel:      3,
		},
		Reading: AssessmentAspectCriteria{
			Name:              "การอ่าน คิดวิเคราะห์ และเขียน",
			ItemCount:         5,
			ExcellentMinGrade: 2.0,
			GoodMinGrade:      1.0,
			PassMinGrade:      0.0,
			DefaultLevel:      3,
		},
		Competency: AssessmentAspectCriteria{
			Name:              "สมรรถนะสำคัญของผู้เรียน",
			ItemCount:         5,
			ExcellentMinGrade: 2.0,
			GoodMinGrade:      1.0,
			PassMinGrade:      0.0,
			DefaultLevel:      3,
		},
		SpecialGradeRules: SpecialGradeCriteria{
			MsLevel: 1,
			RLevel:  1,
		},
	}
}

// LoadCurrentAssessmentCriteria loads config from DB or returns defaults
func LoadCurrentAssessmentCriteria() AssessmentCriteriaConfig {
	var setting models.SystemSetting
	err := database.DB.Where("key = ?", "assessment_criteria").First(&setting).Error
	if err != nil {
		return GetDefaultAssessmentCriteria()
	}

	var config AssessmentCriteriaConfig
	if err := json.Unmarshal([]byte(setting.Value), &config); err != nil {
		return GetDefaultAssessmentCriteria()
	}
	return config
}

// GetAssessmentCriteria returns the current assessment criteria
func GetAssessmentCriteria(c *fiber.Ctx) error {
	config := LoadCurrentAssessmentCriteria()
	return c.JSON(fiber.Map{
		"criteria": config,
	})
}

// UpdateAssessmentCriteria updates the assessment criteria
func UpdateAssessmentCriteria(c *fiber.Ctx) error {
	var input AssessmentCriteriaConfig
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body: " + err.Error()})
	}

	// Enforce valid item counts
	input.Desirable.ItemCount = 8
	input.Reading.ItemCount = 5
	input.Competency.ItemCount = 5

	if input.Mode == "" {
		input.Mode = "GRADE_BASED"
	}

	bytes, err := json.MarshalIndent(input, "", "  ")
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to serialize criteria config"})
	}

	var setting models.SystemSetting
	err = database.DB.Where("key = ?", "assessment_criteria").First(&setting).Error
	if err == gorm.ErrRecordNotFound {
		setting = models.SystemSetting{
			Key:         "assessment_criteria",
			Value:       string(bytes),
			Description: "เกณฑ์การคำนวณการประเมิน 3 ด้านอัตโนมัติจากผลการเรียน",
			UpdatedAt:   time.Now(),
		}
		if err := database.DB.Create(&setting).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create setting: " + err.Error()})
		}
	} else if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database error: " + err.Error()})
	} else {
		setting.Value = string(bytes)
		setting.UpdatedAt = time.Now()
		if err := database.DB.Save(&setting).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update setting: " + err.Error()})
		}
	}

	return c.JSON(fiber.Map{
		"message":  "บันทึกเกณฑ์การประเมิน 3 ด้านสำเร็จ",
		"criteria": input,
	})
}

// GetPublicSettings returns system settings that are safe for public consumption (theming, branding)
func GetPublicSettings(c *fiber.Ctx) error {
	publicKeys := []string{
		"system_name",
		"school_name",
		"school_address",
		"site_copyright",
		"theme_primary_color",
		"theme_auto_color_enabled",
		"theme_day_color_sun",
		"theme_day_color_mon",
		"theme_day_color_tue",
		"theme_day_color_wed",
		"theme_day_color_thu",
		"theme_day_color_fri",
		"theme_day_color_sat",
		"site_logo",
		"site_favicon",
	}

	var settings []models.SystemSetting
	if err := database.DB.Where("key IN ?", publicKeys).Find(&settings).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch settings: " + err.Error()})
	}

	result := make(map[string]string)
	for _, s := range settings {
		result[s.Key] = s.Value
	}

	// Fallback defaults if not set in DB
	if _, ok := result["system_name"]; !ok {
		result["system_name"] = "NewTEA - Triam Evaluation & Assessment"
	}
	if _, ok := result["school_name"]; !ok {
		result["school_name"] = "โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ"
	}
	if _, ok := result["theme_primary_color"]; !ok {
		result["theme_primary_color"] = "#5f06c4"
	}
	if _, ok := result["theme_auto_color_enabled"]; !ok {
		result["theme_auto_color_enabled"] = "false"
	}

	return c.JSON(fiber.Map{
		"data":     result,
		"settings": result,
	})
}

// GetAllSettings returns all system settings as a key-value map for administrators
func GetAllSettings(c *fiber.Ctx) error {
	var settings []models.SystemSetting
	if err := database.DB.Find(&settings).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch settings: " + err.Error()})
	}

	result := make(map[string]string)
	for _, s := range settings {
		result[s.Key] = s.Value
	}

	return c.JSON(fiber.Map{
		"data":     result,
		"settings": result,
	})
}

// UpdateSystemSettings updates or inserts multiple system settings from a key-value map
func UpdateSystemSettings(c *fiber.Ctx) error {
	var input map[string]string
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body: " + err.Error()})
	}

	now := time.Now()
	for k, v := range input {
		var setting models.SystemSetting
		err := database.DB.Where("key = ?", k).First(&setting).Error
		if err == gorm.ErrRecordNotFound {
			setting = models.SystemSetting{
				Key:       k,
				Value:     v,
				UpdatedAt: now,
			}
			database.DB.Create(&setting)
		} else if err == nil {
			setting.Value = v
			setting.UpdatedAt = now
			database.DB.Save(&setting)
		}
	}

	return c.JSON(fiber.Map{
		"message":  "บันทึกการตั้งค่าระบบเรียบร้อยแล้ว",
		"settings": input,
	})
}

// UploadSettingImage handles uploading logo or favicon files for branding
func UploadSettingImage(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาเลือกไฟล์รูปภาพที่ต้องการอัปโหลด"})
	}

	// Validate file size <= 5MB
	if file.Size > 5*1024*1024 {
		return c.Status(400).JSON(fiber.Map{"error": "ขนาดไฟล์เกินกำหนด (สูงสุด 5MB)"})
	}

	// Validate extension
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]bool{
		".png":  true,
		".jpg":  true,
		".jpeg": true,
		".svg":  true,
		".webp": true,
		".ico":  true,
		".gif":  true,
	}
	if !allowedExts[ext] {
		return c.Status(400).JSON(fiber.Map{"error": "รองรับเฉพาะไฟล์รูปภาพ (PNG, JPG, JPEG, SVG, WEBP, ICO, GIF)"})
	}

	imageType := strings.TrimSpace(c.FormValue("type"))
	if imageType == "" {
		imageType = "branding"
	}

	brandingDir := filepath.Join(".", "uploads", "branding")
	if err := os.MkdirAll(brandingDir, os.ModePerm); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "ไม่สามารถสร้างโฟลเดอร์สำหรับจัดเก็บไฟล์ได้"})
	}

	cleanFileName := fmt.Sprintf("%s_%d%s", imageType, time.Now().UnixNano(), ext)
	targetPath := filepath.Join(brandingDir, cleanFileName)

	if err := c.SaveFile(file, targetPath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "ไม่สามารถบันทึกไฟล์รูปภาพได้: " + err.Error()})
	}

	relPath := "/uploads/branding/" + cleanFileName

	return c.JSON(fiber.Map{
		"success":  true,
		"filePath": relPath,
		"url":      relPath,
		"message":  "อัปโหลดรูปภาพสำเร็จ",
	})
}
