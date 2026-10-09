package services

import (
	"strings"
	"testing"
)

func TestParseAndImportUsers_EmptyFile(t *testing.T) {
	_, err := ParseAndImportUsers(strings.NewReader(""), "users.csv")
	if err == nil {
		t.Fatal("expected error for empty file, got nil")
	}
}

func TestMapHeaderIndicesAndGetColumnValue(t *testing.T) {
	headers := []string{"ชื่อ-สกุล", "อีเมล", "กลุ่มสาระการเรียนรู้", "สิทธิ์", "รหัสผ่าน"}
	m := mapHeaderIndices(headers)

	row := []string{"ครูสมชาย", "somchai@tn.ac.th", "วิทยาศาสตร์", "TEACHER", "12345678"}

	name := getColumnValue(row, m, "name", "ชื่อ-สกุล", "ชื่อ")
	if name != "ครูสมชาย" {
		t.Errorf("expected ครูสมชาย, got %s", name)
	}

	email := getColumnValue(row, m, "email", "อีเมล")
	if email != "somchai@tn.ac.th" {
		t.Errorf("expected somchai@tn.ac.th, got %s", email)
	}

	dept := getColumnValue(row, m, "department", "กลุ่มสาระการเรียนรู้")
	if dept != "วิทยาศาสตร์" {
		t.Errorf("expected วิทยาศาสตร์, got %s", dept)
	}

	role := getColumnValue(row, m, "role", "สิทธิ์")
	if role != "TEACHER" {
		t.Errorf("expected TEACHER, got %s", role)
	}
}
