package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"golang.org/x/crypto/scrypt"
	"golang.org/x/text/unicode/norm"
)

// HashPassword hashes a password using Scrypt to match Better Auth's format:
// saltHex:keyHex (salt = 16 bytes hex, key = 64 bytes scrypt derived key hex)
// Parameters: N=16384, r=16, p=1, dkLen=64
func HashPassword(password string) (string, error) {
	if len(password) == 0 {
		return "", fmt.Errorf("password cannot be empty")
	}

	saltBytes := make([]byte, 16)
	if _, err := rand.Read(saltBytes); err != nil {
		return "", fmt.Errorf("failed to generate random salt: %w", err)
	}
	saltHex := hex.EncodeToString(saltBytes)

	// Unicode NFKC normalization matching Better Auth utils
	normalized := norm.NFKC.String(password)

	key, err := scrypt.Key([]byte(normalized), []byte(saltHex), 16384, 16, 1, 64)
	if err != nil {
		return "", fmt.Errorf("failed to derive scrypt key: %w", err)
	}

	return fmt.Sprintf("%s:%s", saltHex, hex.EncodeToString(key)), nil
}
