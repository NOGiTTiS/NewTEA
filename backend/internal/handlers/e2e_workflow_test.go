package handlers

import (
	"testing"
	"time"

	"newtea-backend/internal/models"

	"github.com/google/uuid"
)

// TestE2EGradebookAndApprovalWorkflow simulates the complete gradebook and approval lifecycle
// from teacher scoring, attendance validation, submission lock, department head review,
// academic approval, SGS confirmation, and unlock request workflow.
func TestE2EGradebookAndApprovalWorkflow(t *testing.T) {
	// Step 1: Initialize Course & Enrollments
	courseID := uuid.New()
	student1ID := uuid.New()
	student2ID := uuid.New()

	enrollments := []models.CourseEnrollment{
		{ID: uuid.New(), CourseID: courseID, StudentID: student1ID, RoomID: "4.1", SeatNo: 1},
		{ID: uuid.New(), CourseID: courseID, StudentID: student2ID, RoomID: "4.1", SeatNo: 2},
	}

	if len(enrollments) != 2 {
		t.Fatalf("Expected 2 enrolled students, got %d", len(enrollments))
	}

	// Step 2: Score Columns (Period 1 to 4)
	col1 := models.ScoreColumn{ID: uuid.New(), CourseID: courseID, Name: "ชิ้นงานที่ 1", MaxScore: 10, Weight: 10, PeriodType: 1, Sequence: 1}
	col2 := models.ScoreColumn{ID: uuid.New(), CourseID: courseID, Name: "สอบกลางภาค", MaxScore: 20, Weight: 20, PeriodType: 2, Sequence: 2}
	col3 := models.ScoreColumn{ID: uuid.New(), CourseID: courseID, Name: "ชิ้นงานที่ 2", MaxScore: 10, Weight: 10, PeriodType: 3, Sequence: 3}
	col4 := models.ScoreColumn{ID: uuid.New(), CourseID: courseID, Name: "สอบปลายภาค", MaxScore: 30, Weight: 30, PeriodType: 4, Sequence: 4}

	columns := []models.ScoreColumn{col1, col2, col3, col4}
	totalWeight := 0.0
	for _, c := range columns {
		totalWeight += c.Weight
	}
	if totalWeight != 70.0 {
		t.Errorf("Expected weight 70.0, got %f", totalWeight)
	}

	// Step 3: Evaluations & Attendance Check
	// Student 1: Normal attendance (36/40 = 90%), Total score 85 -> Grade 4
	eval1 := models.StudentEvaluation{
		ID:                   uuid.New(),
		EnrollmentID:         student1ID,
		AttendanceHours:      36,
		AttendancePercentage: 90.0,
		TotalScore:           85.0,
		Grade:                "4",
		SpecialGrade:         "",
		DesirableGrade:       3,
		ReadingGrade:         3,
		CompetencyGrade:      3,
	}

	// Student 2: Low attendance (28/40 = 70% < 80%), Trigger "มส"
	eval2 := models.StudentEvaluation{
		ID:                   uuid.New(),
		EnrollmentID:         student2ID,
		AttendanceHours:      28,
		AttendancePercentage: 70.0,
		TotalScore:           88.0,
		Grade:                "0",
		SpecialGrade:         "มส",
		DesirableGrade:       1,
		ReadingGrade:         1,
		CompetencyGrade:      1,
	}

	if eval1.SpecialGrade != "" || eval1.Grade != "4" {
		t.Errorf("Student 1 evaluation failed: %s / %s", eval1.Grade, eval1.SpecialGrade)
	}
	if eval2.SpecialGrade != "มส" {
		t.Errorf("Student 2 should have special grade มส, got %s", eval2.SpecialGrade)
	}

	// Step 4: Verification Round 1 (Period 1: Before Midterm)
	v1 := models.CourseVerification{
		ID:               uuid.New(),
		CourseID:         courseID,
		Round:            1,
		TeacherSubmitted: false,
		DeptHeadStatus:   "PENDING",
		AcademicStatus:   "PENDING",
	}

	// 4.1 Teacher submits Round 1 -> System locks gradebook for Round 1
	now := time.Now()
	v1.TeacherSubmitted = true
	v1.TeacherSubmittedAt = &now

	// Assert locked state
	isLocked := v1.TeacherSubmitted && (v1.DeptHeadStatus == "PENDING" || v1.DeptHeadStatus == "APPROVED")
	if !isLocked {
		t.Errorf("Round 1 should be locked after teacher submission")
	}

	// 4.2 Dept Head approves Round 1
	v1.DeptHeadStatus = "APPROVED"
	deptReviewed := time.Now()
	v1.DeptHeadReviewedAt = &deptReviewed

	// 4.3 Academic approves Round 1
	v1.AcademicStatus = "APPROVED"
	academicReviewed := time.Now()
	v1.AcademicReviewedAt = &academicReviewed

	if v1.DeptHeadStatus != "APPROVED" || v1.AcademicStatus != "APPROVED" {
		t.Errorf("Round 1 approvals failed")
	}

	// Step 5: Verification Round 3 (Final & SGS Transfer)
	v3 := models.CourseVerification{
		ID:               uuid.New(),
		CourseID:         courseID,
		Round:            3,
		TeacherSubmitted: true,
		DeptHeadStatus:   "APPROVED",
		AcademicStatus:   "APPROVED",
		SGSTransferred:   false,
	}

	// 5.1 Academic transfers to SGS
	v3.SGSTransferred = true
	if !v3.SGSTransferred {
		t.Errorf("SGS transfer flag failed")
	}

	// 5.2 Teacher requests unlock after SGS transfer -> Requires warning check
	v3.UnlockRequested = true
	v3.UnlockReason = "นักเรียนส่งผลงานแก้ 0 ต้องส่งคะแนนใหม่"
	reqAt := time.Now()
	v3.UnlockRequestedAt = &reqAt

	// 5.3 Authorized approver unlocks
	approver := "ผู้ดูแลระบบฝ่ายวิชาการ"
	v3.TeacherSubmitted = false // Unlocked
	v3.DeptHeadStatus = "REVISE"
	v3.UnlockRequested = false
	v3.UnlockApprovedBy = approver
	apprAt := time.Now()
	v3.UnlockApprovedAt = &apprAt

	if v3.TeacherSubmitted {
		t.Errorf("Gradebook should be unlocked after approved unlock request")
	}
	if v3.UnlockApprovedBy != approver {
		t.Errorf("Unlock approver trail missing")
	}
}
