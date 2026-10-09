package database

import (
	"fmt"
	"log"
	"time"

	"newtea-backend/internal/models"
	"newtea-backend/internal/utils"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(databaseURL string) (*gorm.DB, error) {
	var db *gorm.DB
	var err error
	maxRetries := 10
	for attempt := 1; attempt <= maxRetries; attempt++ {
		db, err = gorm.Open(postgres.Open(databaseURL), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
		if err == nil {
			break
		}
		log.Printf("Database connection attempt %d/%d failed: %v. Retrying in 2 seconds...", attempt, maxRetries, err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database after %d attempts: %w", maxRetries, err)
	}

	log.Println("Database connection established. Configuring connection pool...")

	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxOpenConns(100)
		sqlDB.SetMaxIdleConns(50)
	}

	log.Println("Running auto migrations...")

	// Auto Migrate all models defined in spec
	err = db.AutoMigrate(
		&models.User{},
		&models.Session{},
		&models.Account{},
		&models.Verification{},
		&models.Room{},
		&models.RoomAdvisor{},
		&models.Student{},
		&models.AcademicTerm{},
		&models.VerificationMilestone{},
		&models.Course{},
		&models.CourseTeacher{},
		&models.CourseEnrollment{},
		&models.ScoreColumn{},
		&models.StudentScore{},
		&models.StudentEvaluation{},
		&models.CourseVerification{},
		&models.StudentAuditLog{},
		&models.SystemSetting{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to auto migrate database: %w", err)
	}

	log.Println("Database auto-migration completed successfully.")

	// Ensure courses text columns are text type (prevent SQLSTATE 22P02 invalid input syntax for json)
	_ = db.Exec("ALTER TABLE courses ALTER COLUMN structure_data TYPE text USING structure_data::text").Error
	_ = db.Exec("ALTER TABLE courses ALTER COLUMN description_files TYPE text USING description_files::text").Error
	_ = db.Exec("ALTER TABLE courses ALTER COLUMN structure_files TYPE text USING structure_files::text").Error
	_ = db.Exec("ALTER TABLE courses ALTER COLUMN target_rooms TYPE text USING target_rooms::text").Error
	_ = db.Exec("UPDATE courses SET structure_data = '' WHERE structure_data = '{}'").Error

	// Seed standard 45 classrooms (4.1-4.15, 5.1-5.15, 6.1-6.15) if not exist
	seedInitialRooms(db)
	seedDefaultSettings(db)
	seedInitialAdmin(db)

	DB = db
	return db, nil
}

func seedDefaultSettings(db *gorm.DB) {
	defaultCriteriaJSON := `{
  "mode": "GRADE_BASED",
  "desirable": {
    "name": "คุณลักษณะอันพึงประสงค์",
    "itemCount": 8,
    "excellentMinGrade": 2.0,
    "goodMinGrade": 1.0,
    "passMinGrade": 0.0,
    "defaultLevel": 3
  },
  "reading": {
    "name": "การอ่าน คิดวิเคราะห์ และเขียน",
    "itemCount": 5,
    "excellentMinGrade": 2.0,
    "goodMinGrade": 1.0,
    "passMinGrade": 0.0,
    "defaultLevel": 3
  },
  "competency": {
    "name": "สมรรถนะสำคัญของผู้เรียน",
    "itemCount": 5,
    "excellentMinGrade": 2.0,
    "goodMinGrade": 1.0,
    "passMinGrade": 0.0,
    "defaultLevel": 3
  },
  "specialGradeRules": {
    "msLevel": 1,
    "rLevel": 1
  }
}`

	defaults := []models.SystemSetting{
		{
			Key:         "assessment_criteria",
			Value:       defaultCriteriaJSON,
			Description: "เกณฑ์การคำนวณการประเมิน 3 ด้านอัตโนมัติจากผลการเรียน",
		},
		{
			Key:         "system_name",
			Value:       "NewTEA - Triam Evaluation & Assessment",
			Description: "ชื่อระบบแสดงผลบนหัวเว็บและเอกสาร",
		},
		{
			Key:         "school_name",
			Value:       "โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ",
			Description: "ชื่อสถานศึกษาแสดงในรายงานและ ปพ.5",
		},
		{
			Key:         "school_address",
			Value:       "ตำบลหัวรอ อำเภอเมืองพิษณุโลก จังหวัดพิษณุโลก",
			Description: "ที่อยู่สถานศึกษา",
		},
		{
			Key:         "director_name",
			Value:       "นายยงค์ยุทธ รุ่งแจ้ง",
			Description: "ชื่อ-สกุล ผู้อำนวยการโรงเรียนสำหรับลงนามในเอกสาร",
		},
		{
			Key:         "director_title",
			Value:       "ผู้อำนวยการโรงเรียนเตรียมอุดมศึกษา ภาคเหนือ",
			Description: "ตำแหน่งผู้บริหารสถานศึกษา",
		},
		{
			Key:         "site_copyright",
			Value:       "© 2026 โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ. All rights reserved.",
			Description: "ข้อความท้ายกระดาษและลิขสิทธิ์",
		},
		{
			Key:         "theme_primary_color",
			Value:       "#5f06c4",
			Description: "สีหลักของระบบเมื่อปิดโหมดสีประจำวัน (Default Brand Purple)",
		},
		{
			Key:         "theme_auto_color_enabled",
			Value:       "false",
			Description: "เปิด/ปิดระบบธีมสีประจำวันอัตโนมัติ (true/false)",
		},
		{
			Key:         "theme_day_color_sun",
			Value:       "#dc2626",
			Description: "สีประจำวันอาทิตย์ (Sunday - Red)",
		},
		{
			Key:         "theme_day_color_mon",
			Value:       "#eab308",
			Description: "สีประจำวันจันทร์ (Monday - Yellow)",
		},
		{
			Key:         "theme_day_color_tue",
			Value:       "#ec4899",
			Description: "สีประจำวันอังคาร (Tuesday - Pink)",
		},
		{
			Key:         "theme_day_color_wed",
			Value:       "#059669",
			Description: "สีประจำวันพุธ (Wednesday - Green)",
		},
		{
			Key:         "theme_day_color_thu",
			Value:       "#ea580c",
			Description: "สีประจำวันพฤหัสบดี (Thursday - Orange)",
		},
		{
			Key:         "theme_day_color_fri",
			Value:       "#0284c7",
			Description: "สีประจำวันศุกร์ (Friday - Sky Blue)",
		},
		{
			Key:         "theme_day_color_sat",
			Value:       "#7c3aed",
			Description: "สีประจำวันเสาร์ (Saturday - Purple)",
		},
		{
			Key:         "site_logo",
			Value:       "",
			Description: "URL หรือที่อยู่ไฟล์รูปภาพโลโก้ระบบ",
		},
		{
			Key:         "site_favicon",
			Value:       "",
			Description: "URL หรือที่อยู่ไฟล์ Favicon ของระบบ",
		},
	}

	for _, d := range defaults {
		var count int64
		db.Model(&models.SystemSetting{}).Where("key = ?", d.Key).Count(&count)
		if count == 0 {
			db.Create(&d)
		}
	}
	log.Println("Default system settings seeded.")
}

func seedInitialRooms(db *gorm.DB) {
	var count int64
	db.Model(&models.Room{}).Count(&count)
	if count > 0 {
		return
	}

	log.Println("Seeding standard 45 classrooms (4.1-4.15, 5.1-5.15, 6.1-6.15)...")
	for grade := 4; grade <= 6; grade++ {
		for roomNum := 1; roomNum <= 15; roomNum++ {
			roomId := fmt.Sprintf("%d.%d", grade, roomNum)
			room := models.Room{
				ID:         roomId,
				GradeLevel: grade,
				RoomNumber: roomNum,
			}
			db.FirstOrCreate(&room, models.Room{ID: roomId})
		}
	}
	log.Println("Classroom seeding completed.")
}

func seedInitialAdmin(db *gorm.DB) {
	adminEmail := "admin@tn.ac.th"
	defaultPassword := "Admin@2026"
	now := time.Now()

	var adminUser models.User
	err := db.Where("email ILIKE ?", adminEmail).First(&adminUser).Error
	if err != nil {
		log.Printf("Seeding default initial admin (%s)...", adminEmail)
		adminID := uuid.New().String()
		adminUser = models.User{
			ID:            adminID,
			Name:          "ผู้ดูแลระบบ NewTEA (Admin)",
			Email:         adminEmail,
			EmailVerified: true,
			Role:          "ADMIN",
			Department:    "ฝ่ายวิชาการ",
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if err := db.Create(&adminUser).Error; err != nil {
			log.Printf("Warning: Failed to create default admin user: %v", err)
			return
		}
	} else {
		if adminUser.Role != "ADMIN" {
			db.Model(&adminUser).Update("role", "ADMIN")
			log.Printf("Promoted existing user %s to ADMIN", adminEmail)
		}
	}

	passwordHash, err := utils.HashPassword(defaultPassword)
	if err != nil {
		log.Printf("Warning: Failed to hash default admin password: %v", err)
		return
	}

	var adminAccount models.Account
	err = db.Where("user_id = ? AND provider_id = ?", adminUser.ID, "credential").First(&adminAccount).Error
	if err != nil {
		adminAccount = models.Account{
			ID:         uuid.New().String(),
			UserID:     adminUser.ID,
			AccountID:  adminUser.ID,
			ProviderID: "credential",
			Password:   passwordHash,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if err := db.Create(&adminAccount).Error; err != nil {
			log.Printf("Warning: Failed to create default admin credential account: %v", err)
			return
		}
		log.Printf("Default superadmin credential account created: %s (Password: %s)", adminEmail, defaultPassword)
	} else {
		// Update password to ensure it matches defaultPassword
		db.Model(&adminAccount).Update("password", passwordHash)
		log.Printf("Default superadmin credential account verified: %s (Password: %s)", adminEmail, defaultPassword)
	}
}

