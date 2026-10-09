package handlers

import (
	"newtea-backend/internal/models"
	"testing"
)

func TestCalculateStandardGrade(t *testing.T) {
	cases := []struct {
		score    float64
		expected string
	}{
		{100.0, "4"},
		{85.5, "4"},
		{80.0, "4"},
		{79.995, "4"}, // Round to 80.00
		{79.4, "3.5"},
		{75.0, "3.5"},
		{74.9, "3"},
		{70.0, "3"},
		{69.5, "2.5"},
		{65.0, "2.5"},
		{64.0, "2"},
		{60.0, "2"},
		{59.0, "1.5"},
		{55.0, "1.5"},
		{54.0, "1"},
		{50.0, "1"},
		{49.9, "0"},
		{30.0, "0"},
		{0.0, "0"},
	}

	for _, c := range cases {
		actual := CalculateStandardGrade(c.score)
		if actual != c.expected {
			t.Errorf("CalculateStandardGrade(%f) = %s, expected %s", c.score, actual, c.expected)
		}
	}
}

func TestCalculateAuto3DAssessment(t *testing.T) {
	cases := []struct {
		grade        string
		specialGrade string
		expected     int
	}{
		{"4", "", 3},
		{"3.5", "", 3},
		{"3", "", 3},
		{"2.5", "", 3},
		{"2", "", 3},
		{"1.5", "", 2},
		{"1", "", 2},
		{"0", "", 1},
		{"4", "มส", 1},
		{"3", "ร", 1},
	}

	for _, c := range cases {
		actual := CalculateAuto3DAssessment(c.grade, c.specialGrade)
		if actual != c.expected {
			t.Errorf("CalculateAuto3DAssessment(%s, %s) = %d, expected %d", c.grade, c.specialGrade, actual, c.expected)
		}
	}
}

func TestMapGradeToAspectLevel(t *testing.T) {
	aspect := AssessmentAspectCriteria{
		Name:              "คุณลักษณะอันพึงประสงค์",
		ItemCount:         8,
		ExcellentMinGrade: 2.0,
		GoodMinGrade:      1.0,
		PassMinGrade:      0.0,
		DefaultLevel:      3,
	}
	specialRules := SpecialGradeCriteria{
		MsLevel: 1,
		RLevel:  1,
	}

	cases := []struct {
		grade        string
		specialGrade string
		expected     int
	}{
		{"4", "", 3},
		{"2", "", 3},
		{"1.5", "", 2},
		{"1", "", 2},
		{"0", "", 1},
		{"4", "มส", 1},
		{"3.5", "ร", 1},
	}

	for _, c := range cases {
		actual := MapGradeToAspectLevel(c.grade, c.specialGrade, aspect, specialRules)
		if actual != c.expected {
			t.Errorf("MapGradeToAspectLevel(%s, %s) = %d, expected %d", c.grade, c.specialGrade, actual, c.expected)
		}
	}
}

func TestGenerateSubscoresArray(t *testing.T) {
	json8 := GenerateSubscoresArray(8, 3)
	expected8 := "[3,3,3,3,3,3,3,3]"
	if json8 != expected8 {
		t.Errorf("GenerateSubscoresArray(8, 3) = %s, expected %s", json8, expected8)
	}

	json5 := GenerateSubscoresArray(5, 2)
	expected5 := "[2,2,2,2,2]"
	if json5 != expected5 {
		t.Errorf("GenerateSubscoresArray(5, 2) = %s, expected %s", json5, expected5)
	}
}

func TestGenerateDesirableSubscoresArray(t *testing.T) {
	json3 := GenerateDesirableSubscoresArray(3)
	expected3 := "[3,3,3,3,3,3,3,3]"
	if json3 != expected3 {
		t.Errorf("GenerateDesirableSubscoresArray(3) = %s, expected %s", json3, expected3)
	}

	json2 := GenerateDesirableSubscoresArray(2)
	expected2 := "[3,3,2,2,2,2,2,3]"
	if json2 != expected2 {
		t.Errorf("GenerateDesirableSubscoresArray(2) = %s, expected %s", json2, expected2)
	}

	json1 := GenerateDesirableSubscoresArray(1)
	expected1 := "[3,3,1,1,1,1,1,3]"
	if json1 != expected1 {
		t.Errorf("GenerateDesirableSubscoresArray(1) = %s, expected %s", json1, expected1)
	}
}

func TestCalculateAttendancePercentage(t *testing.T) {
	cases := []struct {
		p1       float64
		p2       float64
		maxP1    float64
		maxP2    float64
		expected float64
		isMs     bool
	}{
		{20.0, 20.0, 20.0, 20.0, 100.0, false},
		{16.0, 16.0, 20.0, 20.0, 80.0, false},
		{15.9, 16.0, 20.0, 20.0, 79.8, true},
		{10.0, 10.0, 20.0, 20.0, 50.0, true},
		{0.0, 0.0, 20.0, 20.0, 0.0, true},
		{25.0, 15.0, 20.0, 20.0, 100.0, false}, // Capped at 100%
		{20.0, 20.0, 0.0, 0.0, 100.0, false},   // 0 max hours fallback
		{18.0, 18.0, 20.0, 20.0, 90.0, false},
	}

	for _, c := range cases {
		pct, isMs := CalculateAttendancePercentage(c.p1, c.p2, c.maxP1, c.maxP2)
		if pct != c.expected || isMs != c.isMs {
			t.Errorf("CalculateAttendancePercentage(%f, %f, %f, %f) = (%f, %t), expected (%f, %t)",
				c.p1, c.p2, c.maxP1, c.maxP2, pct, isMs, c.expected, c.isMs)
		}
	}
}

func TestCourseVerificationModel(t *testing.T) {
	// Verify that Course model includes Verifications slice
	course := models.Course{
		CourseCode: "ว30281",
		CourseName: "หุ่นยนต์อัตโนมัติ 3",
		Verifications: []models.CourseVerification{
			{Round: 1, DeptHeadStatus: "PENDING", AcademicStatus: "PENDING"},
			{Round: 2, DeptHeadStatus: "PENDING", AcademicStatus: "PENDING"},
			{Round: 3, DeptHeadStatus: "PENDING", AcademicStatus: "PENDING"},
		},
	}

	if len(course.Verifications) != 3 {
		t.Errorf("Expected 3 verifications, got %d", len(course.Verifications))
	}
	if course.Verifications[0].Round != 1 {
		t.Errorf("Expected round 1, got %d", course.Verifications[0].Round)
	}
}
