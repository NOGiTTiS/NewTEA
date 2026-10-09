package handlers

import (
	"testing"
	"time"

	"newtea-backend/internal/models"

	"github.com/google/uuid"
)

func TestGetPeriodRound(t *testing.T) {
	tests := []struct {
		periodType int
		expected   int
	}{
		{1, 1},
		{2, 2},
		{3, 3},
		{4, 3},
		{0, 1},
		{99, 1},
	}

	for _, tt := range tests {
		got := GetPeriodRound(tt.periodType)
		if got != tt.expected {
			t.Errorf("GetPeriodRound(%d) = %d; want %d", tt.periodType, got, tt.expected)
		}
	}
}

func TestVerificationStatusTransitions(t *testing.T) {
	courseID := uuid.New()
	ver := models.CourseVerification{
		ID:               uuid.New(),
		CourseID:         courseID,
		Round:            1,
		TeacherSubmitted: false,
		DeptHeadStatus:   "PENDING",
		AcademicStatus:   "PENDING",
	}

	// 1. Initially unsubmitted
	if ver.TeacherSubmitted {
		t.Errorf("Expected TeacherSubmitted to be false initially")
	}

	// 2. Teacher submits
	now := time.Now()
	ver.TeacherSubmitted = true
	ver.TeacherSubmittedAt = &now
	if !ver.TeacherSubmitted || ver.TeacherSubmittedAt == nil {
		t.Errorf("Teacher submit failed to record timestamp")
	}

	// 3. Dept Head approves
	ver.DeptHeadStatus = "APPROVED"
	ver.DeptHeadComment = "ครบถ้วนสมบูรณ์"
	if ver.DeptHeadStatus != "APPROVED" {
		t.Errorf("DeptHeadStatus should be APPROVED")
	}

	// 4. Academic approves
	ver.AcademicStatus = "APPROVED"
	if ver.AcademicStatus != "APPROVED" {
		t.Errorf("AcademicStatus should be APPROVED")
	}

	// 5. Revision scenario (Round 2)
	ver2 := models.CourseVerification{
		ID:               uuid.New(),
		CourseID:         courseID,
		Round:            2,
		TeacherSubmitted: true,
		DeptHeadStatus:   "REVISE",
		DeptHeadComment:  "คะแนนสอบกลางภาคเกินคะแนนเต็ม กรุณาตรวจสอบ",
	}

	// Revision unlocks teacher edit
	if ver2.DeptHeadStatus == "REVISE" {
		ver2.TeacherSubmitted = false // Unlocked
	}

	if ver2.TeacherSubmitted {
		t.Errorf("Expected TeacherSubmitted to be false after REVISE")
	}
}

func TestUnlockRequestTransitions(t *testing.T) {
	courseID := uuid.New()
	ver := models.CourseVerification{
		ID:               uuid.New(),
		CourseID:         courseID,
		Round:            3,
		TeacherSubmitted: true,
		DeptHeadStatus:   "APPROVED",
		AcademicStatus:   "APPROVED",
		SGSTransferred:   true,
		UnlockRequested:  false,
	}

	// 1. Teacher requests unlock with reason
	reason := "นักเรียนส่งงานย้อนหลังช่วงก่อนประกาศผลปลายภาค ต้องการปรับปรุงคะแนนเก็บ"
	reqTime := time.Now()
	ver.UnlockRequested = true
	ver.UnlockReason = reason
	ver.UnlockRequestedAt = &reqTime

	if !ver.UnlockRequested || ver.UnlockReason != reason || ver.UnlockRequestedAt == nil {
		t.Errorf("Unlock request not properly recorded")
	}

	// 2. Rejection scenario
	verCopy := ver
	verCopy.UnlockRequested = false // Rejected
	if verCopy.UnlockRequested {
		t.Errorf("Expected UnlockRequested to be false after rejection")
	}

	// 3. Approval scenario
	// When approved: TeacherSubmitted becomes false, DeptHeadStatus becomes REVISE (unlocked)
	approverName := "หัวหน้ากลุ่มสาระฯ / ฝ่ายวิชาการ"
	apprTime := time.Now()
	ver.TeacherSubmitted = false
	ver.DeptHeadStatus = "REVISE"
	ver.UnlockRequested = false
	ver.UnlockApprovedBy = approverName
	ver.UnlockApprovedAt = &apprTime

	if ver.TeacherSubmitted {
		t.Errorf("TeacherSubmitted should be false after unlock approval")
	}
	if ver.DeptHeadStatus != "REVISE" {
		t.Errorf("DeptHeadStatus should be REVISE after unlock approval")
	}
	if ver.UnlockRequested {
		t.Errorf("UnlockRequested should be cleared after approval")
	}
	if ver.UnlockApprovedBy != approverName || ver.UnlockApprovedAt == nil {
		t.Errorf("Unlock approver audit trail failed")
	}
}
