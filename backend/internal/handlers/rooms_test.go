package handlers

import (
	"fmt"
	"testing"
)

func TestRoomValidationRules(t *testing.T) {
	testCases := []struct {
		grade      int
		roomNumber int
		expectedID string
		isValid    bool
	}{
		{4, 1, "4.1", true},
		{4, 15, "4.15", true},
		{4, 16, "4.16", true},
		{5, 1, "5.1", true},
		{5, 16, "5.16", true},
		{6, 15, "6.15", true},
		{6, 20, "6.20", true},
		{3, 1, "", false},    // Grade too low
		{7, 1, "", false},    // Grade too high
		{4, 0, "", false},    // Room number too low
		{4, 100, "", false},  // Room number too high
	}

	for _, tc := range testCases {
		isValidGrade := tc.grade >= 4 && tc.grade <= 6
		isValidRoom := tc.roomNumber >= 1 && tc.roomNumber <= 99
		valid := isValidGrade && isValidRoom

		if valid != tc.isValid {
			t.Errorf("Grade %d Room %d validity: expected %v, got %v", tc.grade, tc.roomNumber, tc.isValid, valid)
		}

		if valid {
			id := fmt.Sprintf("%d.%d", tc.grade, tc.roomNumber)
			if id != tc.expectedID {
				t.Errorf("Expected Room ID %s, got %s", tc.expectedID, id)
			}
		}
	}
}
