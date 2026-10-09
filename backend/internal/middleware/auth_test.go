package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"newtea-backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func TestRequireRole(t *testing.T) {
	tests := []struct {
		name         string
		userRole     string
		allowedRoles []string
		expectedCode int
	}{
		{
			name:         "Admin has universal access even if not in allowed list",
			userRole:     "ADMIN",
			allowedRoles: []string{"TEACHER"},
			expectedCode: http.StatusOK,
		},
		{
			name:         "User matching allowed role gets access",
			userRole:     "ACADEMIC",
			allowedRoles: []string{"ADMIN", "ACADEMIC"},
			expectedCode: http.StatusOK,
		},
		{
			name:         "Teacher denied access to admin-only resource",
			userRole:     "TEACHER",
			allowedRoles: []string{"ADMIN"},
			expectedCode: http.StatusForbidden,
		},
		{
			name:         "Dept head matching allowed role gets access",
			userRole:     "DEPT_HEAD",
			allowedRoles: []string{"DEPT_HEAD", "ADMIN"},
			expectedCode: http.StatusOK,
		},
		{
			name:         "Advisor denied access to academic-only resource",
			userRole:     "ADVISOR",
			allowedRoles: []string{"ACADEMIC"},
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			app := fiber.New()

			// Middleware to inject fake user context
			app.Use(func(c *fiber.Ctx) error {
				if tc.userRole != "" {
					c.Locals("user", models.User{
						ID:   "test-user-id",
						Role: tc.userRole,
						Name: "Test User",
					})
				}
				return c.Next()
			})

			app.Get("/test", RequireRole(tc.allowedRoles...), func(c *fiber.Ctx) error {
				return c.SendStatus(http.StatusOK)
			})

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("Failed to test app: %v", err)
			}

			if resp.StatusCode != tc.expectedCode {
				t.Errorf("Expected status %d, got %d", tc.expectedCode, resp.StatusCode)
			}
		})
	}
}

func TestRequireRole_Unauthenticated(t *testing.T) {
	app := fiber.New()
	app.Get("/test", RequireRole("ADMIN"), func(c *fiber.Ctx) error {
		return c.SendStatus(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Failed to test app: %v", err)
	}

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized for missing user context, got %d", resp.StatusCode)
	}
}
