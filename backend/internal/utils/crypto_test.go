package utils

import (
	"strings"
	"testing"
)

func TestHashPassword(t *testing.T) {
	password := "Admin@2026"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	parts := strings.Split(hash, ":")
	if len(parts) != 2 {
		t.Fatalf("expected hash in format salt:key, got %s", hash)
	}

	salt := parts[0]
	key := parts[1]

	// Salt should be 16 bytes hex = 32 chars
	if len(salt) != 32 {
		t.Errorf("expected salt length 32, got %d", len(salt))
	}

	// Key should be 64 bytes hex = 128 chars
	if len(key) != 128 {
		t.Errorf("expected key length 128, got %d", len(key))
	}

	// Empty password should error
	_, err = HashPassword("")
	if err == nil {
		t.Errorf("expected error for empty password, got nil")
	}
}
