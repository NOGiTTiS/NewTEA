package handlers

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestBrandingImageValidation(t *testing.T) {
	allowedExts := map[string]bool{
		".png":  true,
		".jpg":  true,
		".jpeg": true,
		".svg":  true,
		".webp": true,
		".ico":  true,
		".gif":  true,
	}

	testCases := []struct {
		filename string
		fileSize int64
		expected bool
	}{
		{"school_logo.png", 1024 * 1024, true},
		{"FAVICON.ICO", 64 * 1024, true},
		{"vector_logo.svg", 500 * 1024, true},
		{"photo.WEBP", 2 * 1024 * 1024, true},
		{"script.exe", 1024, false},
		{"malicious.php", 1024, false},
		{"document.pdf", 1024 * 1024, false},
		{"huge_logo.png", 6 * 1024 * 1024, false}, // > 5MB
	}

	maxSize := int64(5 * 1024 * 1024)

	for _, tc := range testCases {
		ext := strings.ToLower(filepath.Ext(tc.filename))
		isValidExt := allowedExts[ext]
		isValidSize := tc.fileSize <= maxSize
		valid := isValidExt && isValidSize

		if valid != tc.expected {
			t.Errorf("Validation for %s (size %d): expected %v, got %v", tc.filename, tc.fileSize, tc.expected, valid)
		}
	}
}
