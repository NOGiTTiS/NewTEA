package services

import (
	"encoding/csv"
	"fmt"
	"io"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"newtea-backend/internal/database"
	"newtea-backend/internal/models"
	"newtea-backend/internal/utils"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ImportResult struct {
	TotalProcessed int      `json:"totalProcessed"`
	CreatedCount   int      `json:"createdCount"`
	UpdatedCount   int      `json:"updatedCount"`
	Errors         []string `json:"errors"`
}

// ParseAndImportStudents handles both CSV and Excel (.xlsx) file uploads
func ParseAndImportStudents(reader io.Reader, filename string) (*ImportResult, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	var rows [][]string

	if ext == ".xlsx" || ext == ".xls" {
		f, err := excelize.OpenReader(reader)
		if err != nil {
			return nil, fmt.Errorf("failed to read excel file: %w", err)
		}
		defer f.Close()

		sheets := f.GetSheetList()
		if len(sheets) == 0 {
			return nil, fmt.Errorf("excel file has no sheets")
		}
		rows, err = f.GetRows(sheets[0])
		if err != nil {
			return nil, fmt.Errorf("failed to get rows from excel: %w", err)
		}
	} else {
		csvReader := csv.NewReader(reader)
		csvReader.FieldsPerRecord = -1 // Allow variable number of fields
		var err error
		rows, err = csvReader.ReadAll()
		if err != nil {
			return nil, fmt.Errorf("failed to parse csv file: %w", err)
		}
	}

	if len(rows) < 2 {
		return nil, fmt.Errorf("file must contain a header row and at least one data row")
	}

	headerMap := mapHeaderIndices(rows[0])
	result := &ImportResult{
		Errors: make([]string, 0),
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		for i := 1; i < len(rows); i++ {
			row := rows[i]
			if len(row) == 0 || isRowEmpty(row) {
				continue
			}
			result.TotalProcessed++

			studentCode := getColumnValue(row, headerMap, "student_id", "เลขประจำตัว", "รหัสนักเรียน", "code")
			if studentCode == "" {
				result.Errors = append(result.Errors, fmt.Sprintf("แถวที่ %d: ไม่พบรหัสประจำตัวนักเรียน", i+1))
				continue
			}

			firstName := getColumnValue(row, headerMap, "first_name", "ชื่อ", "name")
			lastName := getColumnValue(row, headerMap, "last_name", "สกุล", "นามสกุล", "surname")
			prefix := getColumnValue(row, headerMap, "prefix", "คำนำหน้า", "คำนำหน้านาม")
			roomID := getColumnValue(row, headerMap, "room", "room_id", "ห้อง", "ห้องเรียน", "ชั้น")
			roomID = cleanRoomID(roomID)

			seatNoStr := getColumnValue(row, headerMap, "seat_no", "เลขที่", "seat")
			seatNo, _ := strconv.Atoi(seatNoStr)
			if seatNo == 0 {
				seatNo = i // Fallback to row index if seat is omitted
			}

			nationalID := getColumnValue(row, headerMap, "national_id", "เลขประชาชน", "เลขบัตรประชาชน")
			langGroup := getColumnValue(row, headerMap, "language_group", "ภาษาที่3", "ภาษา", "lang")
			electiveGroup := getColumnValue(row, headerMap, "elective_group", "วิชาเลือก", "elective")
			status := getColumnValue(row, headerMap, "status", "สถานะ")
			if status == "" {
				status = "ACTIVE"
			}

			// Ensure room exists
			if roomID != "" {
				var room models.Room
				if err := tx.FirstOrCreate(&room, models.Room{
					ID:         roomID,
					GradeLevel: extractGradeLevel(roomID),
					RoomNumber: extractRoomNumber(roomID),
				}).Error; err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("แถวที่ %d: ไม่สามารถสร้าง/ค้นหาห้อง %s ได้", i+1, roomID))
					continue
				}
			}

			var existing models.Student
			findErr := tx.Where("student_code = ?", studentCode).First(&existing).Error

			if findErr == gorm.ErrRecordNotFound {
				newStudent := models.Student{
					ID:            uuid.New(),
					StudentCode:   studentCode,
					NationalID:    nationalID,
					Prefix:        prefix,
					FirstName:     firstName,
					LastName:      lastName,
					RoomID:        roomID,
					SeatNo:        seatNo,
					LanguageGroup: langGroup,
					ElectiveGroup: electiveGroup,
					Status:        status,
				}
				if err := tx.Create(&newStudent).Error; err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("แถวที่ %d: บันทึกข้อมูลไม่สำเร็จ: %v", i+1, err))
					continue
				}
				result.CreatedCount++
			} else if findErr == nil {
				existing.NationalID = nationalID
				existing.Prefix = prefix
				existing.FirstName = firstName
				existing.LastName = lastName
				existing.RoomID = roomID
				existing.SeatNo = seatNo
				existing.LanguageGroup = langGroup
				existing.ElectiveGroup = electiveGroup
				existing.Status = status
				if err := tx.Save(&existing).Error; err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("แถวที่ %d: อัปเดตข้อมูลไม่สำเร็จ: %v", i+1, err))
					continue
				}
				result.UpdatedCount++
			} else {
				result.Errors = append(result.Errors, fmt.Sprintf("แถวที่ %d: ข้อผิดพลาดฐานข้อมูล: %v", i+1, findErr))
			}
		}
		return nil
	})

	return result, err
}

// ParseAndImportAdvisors parses room advisors from CSV/Excel
// Supports format: Room, Advisor 1, Room, Advisor 2, Room, Advisor 3
func ParseAndImportAdvisors(reader io.Reader, filename string) (*ImportResult, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	var rows [][]string

	if ext == ".xlsx" || ext == ".xls" {
		f, err := excelize.OpenReader(reader)
		if err != nil {
			return nil, fmt.Errorf("failed to read excel file: %w", err)
		}
		defer f.Close()

		sheets := f.GetSheetList()
		if len(sheets) == 0 {
			return nil, fmt.Errorf("excel file has no sheets")
		}
		rows, err = f.GetRows(sheets[0])
		if err != nil {
			return nil, fmt.Errorf("failed to get rows from excel: %w", err)
		}
	} else {
		csvReader := csv.NewReader(reader)
		csvReader.FieldsPerRecord = -1
		var err error
		rows, err = csvReader.ReadAll()
		if err != nil {
			return nil, fmt.Errorf("failed to parse csv file: %w", err)
		}
	}

	if len(rows) < 2 {
		return nil, fmt.Errorf("file must contain a header row and at least one data row")
	}

	result := &ImportResult{
		Errors: make([]string, 0),
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// Clear existing advisors or update them
		for i := 1; i < len(rows); i++ {
			row := rows[i]
			if len(row) == 0 || isRowEmpty(row) {
				continue
			}
			result.TotalProcessed++

			// Handle TUNorth format:
			// Col 0: Room, Col 1: Advisor 1, Col 2: Room, Col 3: Advisor 2, Col 4: Room, Col 5: Advisor 3
			roomID := cleanRoomID(row[0])
			if roomID == "" {
				continue
			}

			// Ensure room exists
			var room models.Room
			tx.FirstOrCreate(&room, models.Room{
				ID:         roomID,
				GradeLevel: extractGradeLevel(roomID),
				RoomNumber: extractRoomNumber(roomID),
			})

			// Remove existing advisors for this room in current import to re-sync
			tx.Where("room_id = ?", roomID).Delete(&models.RoomAdvisor{})

			// Loop through pairs of advisor columns
			advisorCols := []int{1, 3, 5}
			order := 1
			for _, colIdx := range advisorCols {
				if colIdx < len(row) {
					advisorName := strings.TrimSpace(row[colIdx])
					if advisorName != "" {
						// Find or create Teacher user
						teacherUser := findOrCreateTeacher(tx, advisorName)
						advisor := models.RoomAdvisor{
							ID:           uuid.New(),
							RoomID:       roomID,
							UserID:       teacherUser.ID,
							AdvisorOrder: order,
						}
						if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&advisor).Error; err == nil {
							result.CreatedCount++
						}
						order++
					}
				}
			}
		}
		return nil
	})

	return result, err
}

// ParseAndImportUsers parses and imports users (teachers, staff, admins) from CSV or Excel (.xlsx)
func ParseAndImportUsers(reader io.Reader, filename string) (*ImportResult, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	var rows [][]string

	if ext == ".xlsx" || ext == ".xls" {
		f, err := excelize.OpenReader(reader)
		if err != nil {
			return nil, fmt.Errorf("failed to read excel file: %w", err)
		}
		defer f.Close()

		sheets := f.GetSheetList()
		if len(sheets) == 0 {
			return nil, fmt.Errorf("excel file has no sheets")
		}
		rows, err = f.GetRows(sheets[0])
		if err != nil {
			return nil, fmt.Errorf("failed to get rows from excel: %w", err)
		}
	} else {
		csvReader := csv.NewReader(reader)
		csvReader.FieldsPerRecord = -1
		var err error
		rows, err = csvReader.ReadAll()
		if err != nil {
			return nil, fmt.Errorf("failed to parse csv file: %w", err)
		}
	}

	if len(rows) < 2 {
		return nil, fmt.Errorf("file must contain a header row and at least one data row")
	}

	headerMap := mapHeaderIndices(rows[0])
	result := &ImportResult{
		Errors: make([]string, 0),
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		for i := 1; i < len(rows); i++ {
			row := rows[i]
			if len(row) == 0 || isRowEmpty(row) {
				continue
			}
			result.TotalProcessed++

			name := getColumnValue(row, headerMap, "name", "ชื่อ-สกุล", "ชื่อ นามสกุล", "ชื่อ-นามสกุล", "ชื่อสกุล", "ชื่อ", "fullname")
			if name == "" {
				firstName := getColumnValue(row, headerMap, "first_name", "firstname")
				lastName := getColumnValue(row, headerMap, "last_name", "lastname", "surname")
				if firstName != "" || lastName != "" {
					name = strings.TrimSpace(firstName + " " + lastName)
				}
			}

			email := strings.ToLower(getColumnValue(row, headerMap, "email", "อีเมล", "e-mail", "mail"))
			department := getColumnValue(row, headerMap, "department", "กลุ่มสาระ", "กลุ่มสาระฯ", "กลุ่มสาระการเรียนรู้", "สาระการเรียนรู้", "กลุ่มสาระฯ/แผนก", "แผนก")
			roleRaw := strings.ToUpper(getColumnValue(row, headerMap, "role", "สิทธิ์", "บทบาท", "ตำแหน่ง", "สถานะ"))
			password := getColumnValue(row, headerMap, "password", "รหัสผ่าน", "pass")

			if name == "" {
				result.Errors = append(result.Errors, fmt.Sprintf("แถวที่ %d: ไม่พบชื่อ-นามสกุล", i+1))
				continue
			}

			if email == "" || !strings.Contains(email, "@") {
				result.Errors = append(result.Errors, fmt.Sprintf("แถวที่ %d: อีเมลไม่ถูกต้อง (%s)", i+1, email))
				continue
			}

			// Normalize role
			role := "TEACHER"
			switch roleRaw {
			case "ADMIN", "ผู้ดูแลระบบ", "แอดมิน":
				role = "ADMIN"
			case "ACADEMIC", "ฝ่ายวิชาการ", "งานวัดผล", "วิชาการ":
				role = "ACADEMIC"
			case "DEPT_HEAD", "หัวหน้ากลุ่มสาระ", "หัวหน้ากลุ่มสาระฯ", "หัวหน้ากลุ่มสาระการเรียนรู้":
				role = "DEPT_HEAD"
			case "ADVISOR", "ครูที่ปรึกษา":
				role = "ADVISOR"
			case "TEACHER", "ครู", "ครูผู้สอน", "อาจารย์":
				role = "TEACHER"
			default:
				if roleRaw != "" {
					for _, vr := range []string{"ADMIN", "ACADEMIC", "DEPT_HEAD", "TEACHER", "ADVISOR"} {
						if roleRaw == vr {
							role = vr
							break
						}
					}
				}
			}

			if password == "" {
				password = "Tunorth@2026"
			}

			var existing models.User
			findErr := tx.Where("LOWER(email) = ?", email).First(&existing).Error

			if findErr == gorm.ErrRecordNotFound {
				// Check if user was previously auto-created by name (e.g. from advisor import)
				var nameMatch models.User
				if tx.Where("name = ?", name).First(&nameMatch).Error == nil {
					existing = nameMatch
					existing.Email = email
					findErr = nil
				}
			}

			if findErr == gorm.ErrRecordNotFound {
				// New User
				now := time.Now()
				newUserID := uuid.New().String()
				newUser := models.User{
					ID:            newUserID,
					Name:          name,
					Email:         email,
					Role:          role,
					Department:    department,
					EmailVerified: true,
					CreatedAt:     now,
					UpdatedAt:     now,
				}
				if err := tx.Create(&newUser).Error; err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("แถวที่ %d: ไม่สามารถสร้างผู้ใช้ได้: %v", i+1, err))
					continue
				}

				hash, err := utils.HashPassword(password)
				if err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("แถวที่ %d: ไม่สามารถสร้างรหัสผ่านได้: %v", i+1, err))
					continue
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
				if err := tx.Create(&account).Error; err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("แถวที่ %d: ไม่สามารถสร้างบัญชีล็อกอินได้: %v", i+1, err))
					continue
				}

				result.CreatedCount++
			} else if findErr == nil {
				// Existing User: Update name, department, role
				existing.Name = name
				if department != "" {
					existing.Department = department
				}
				if roleRaw != "" {
					existing.Role = role
				}
				existing.UpdatedAt = time.Now()
				if err := tx.Save(&existing).Error; err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("แถวที่ %d: ไม่สามารถอัปเดตผู้ใช้ได้: %v", i+1, err))
					continue
				}

				// Ensure credential account exists for user
				var accCount int64
				tx.Model(&models.Account{}).Where("user_id = ? AND provider_id = 'credential'", existing.ID).Count(&accCount)
				if accCount == 0 {
					hash, err := utils.HashPassword(password)
					if err == nil {
						account := models.Account{
							ID:         uuid.New().String(),
							UserID:     existing.ID,
							AccountID:  existing.ID,
							ProviderID: "credential",
							Password:   hash,
							CreatedAt:  time.Now(),
							UpdatedAt:  time.Now(),
						}
						tx.Create(&account)
					}
				}

				result.UpdatedCount++
			} else {
				result.Errors = append(result.Errors, fmt.Sprintf("แถวที่ %d: ข้อผิดพลาดฐานข้อมูล: %v", i+1, findErr))
			}
		}
		return nil
	})

	return result, err
}

func findOrCreateTeacher(tx *gorm.DB, name string) models.User {
	var user models.User
	err := tx.Where("name = ?", name).First(&user).Error
	if err == nil {
		return user
	}

	// Generate safe email placeholder e.g. teacher_<hash>@tn.ac.th
	safeID := uuid.New().String()
	emailName := strings.ToLower(strings.ReplaceAll(name, " ", "."))
	placeholderEmail := fmt.Sprintf("%s@tn.ac.th", emailName)

	user = models.User{
		ID:         safeID,
		Email:      placeholderEmail,
		Name:       name,
		Role:       "TEACHER",
		Department: "กลุ่มสาระการเรียนรู้",
	}
	tx.FirstOrCreate(&user, models.User{Name: name})
	return user
}

func mapHeaderIndices(headers []string) map[string]int {
	m := make(map[string]int)
	for i, h := range headers {
		cleaned := strings.ToLower(strings.TrimSpace(h))
		m[cleaned] = i
	}
	return m
}

func getColumnValue(row []string, headerMap map[string]int, aliases ...string) string {
	for _, alias := range aliases {
		cleaned := strings.ToLower(alias)
		if idx, ok := headerMap[cleaned]; ok && idx < len(row) {
			return strings.TrimSpace(row[idx])
		}
	}
	return ""
}

func cleanRoomID(room string) string {
	room = strings.TrimSpace(room)
	// Replace slash with dot e.g. 4/1 -> 4.1
	room = strings.ReplaceAll(room, "/", ".")
	room = strings.TrimPrefix(room, "ม.")
	room = strings.TrimPrefix(room, "ม")
	return strings.TrimSpace(room)
}

func extractGradeLevel(roomID string) int {
	parts := strings.Split(roomID, ".")
	if len(parts) > 0 {
		lvl, _ := strconv.Atoi(parts[0])
		if lvl >= 4 && lvl <= 6 {
			return lvl
		}
	}
	return 4
}

func extractRoomNumber(roomID string) int {
	parts := strings.Split(roomID, ".")
	if len(parts) > 1 {
		num, _ := strconv.Atoi(parts[1])
		if num >= 1 && num <= 99 {
			return num
		}
	}
	return 1
}

func isRowEmpty(row []string) bool {
	for _, val := range row {
		if strings.TrimSpace(val) != "" {
			return false
		}
	}
	return true
}
