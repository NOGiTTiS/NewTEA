package handlers

import (
	"testing"
)

func TestValidRolesList(t *testing.T) {
	expected := []string{"ADMIN", "ACADEMIC", "DEPT_HEAD", "TEACHER", "ADVISOR"}
	if len(ValidRoles) != len(expected) {
		t.Fatalf("expected %d valid roles, got %d", len(expected), len(ValidRoles))
	}

	for i, r := range expected {
		if ValidRoles[i] != r {
			t.Errorf("expected role %s at index %d, got %s", r, i, ValidRoles[i])
		}
	}
}

func TestRoleValidationLogic(t *testing.T) {
	testRoles := []struct {
		role  string
		valid bool
	}{
		{"ADMIN", true},
		{"ACADEMIC", true},
		{"DEPT_HEAD", true},
		{"TEACHER", true},
		{"ADVISOR", true},
		{"STUDENT", false},
		{"SUPERADMIN", false},
		{"", false},
	}

	for _, tc := range testRoles {
		isValid := false
		for _, r := range ValidRoles {
			if r == tc.role {
				isValid = true
				break
			}
		}
		if isValid != tc.valid {
			t.Errorf("role %s validity expected %v, got %v", tc.role, tc.valid, isValid)
		}
	}
}
