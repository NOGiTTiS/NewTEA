package middleware

import (
	"strings"
	"time"

	"newtea-backend/internal/database"
	"newtea-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// extractToken retrieves the Better Auth session token from headers or cookies
func extractToken(c *fiber.Ctx) string {
	// 1. Authorization Bearer header
	authHeader := c.Get("Authorization")
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}

	// 2. Custom header
	if customHeader := c.Get("X-Session-Token"); customHeader != "" {
		return customHeader
	}

	// 3. Better Auth session cookie
	if token := c.Cookies("better-auth.session_token"); token != "" {
		return token
	}

	// 4. Secure Better Auth cookie
	if token := c.Cookies("__Secure-better-auth.session_token"); token != "" {
		return token
	}

	return ""
}

// findSessionAndUser locates session and user from DB
func findSessionAndUser(rawToken string) (*models.Session, *models.User, error) {
	if rawToken == "" {
		return nil, nil, fiber.ErrUnauthorized
	}

	// Token might be signed by Better Auth secret as "token.signature"
	tokenCandidate := rawToken
	if idx := strings.Index(rawToken, "."); idx != -1 {
		tokenCandidate = rawToken[:idx]
	}

	var session models.Session
	err := database.DB.Where("(token = ? OR token = ?) AND expires_at > ?", rawToken, tokenCandidate, time.Now()).First(&session).Error
	if err != nil {
		return nil, nil, err
	}

	var user models.User
	err = database.DB.Where("id = ?", session.UserID).First(&user).Error
	if err != nil {
		return nil, nil, err
	}

	return &session, &user, nil
}

// Authenticate enforces authentication and attaches User & Session to Fiber context
func Authenticate(c *fiber.Ctx) error {
	token := extractToken(c)
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized: Missing session token",
		})
	}

	session, user, err := findSessionAndUser(token)
	if err != nil || user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized: Invalid or expired session",
		})
	}

	c.Locals("user", *user)
	c.Locals("session", *session)
	return c.Next()
}

// OptionalAuthenticate attempts to load user from session if present, but doesn't block unauthenticated callers
func OptionalAuthenticate(c *fiber.Ctx) error {
	token := extractToken(c)
	if token != "" {
		session, user, err := findSessionAndUser(token)
		if err == nil && user != nil {
			c.Locals("user", *user)
			c.Locals("session", *session)
		}
	}
	return c.Next()
}

// RequireRole checks if the authenticated user has one of the allowed roles
func RequireRole(allowedRoles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userVal := c.Locals("user")
		if userVal == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Unauthorized: Please log in to continue",
			})
		}

		user, ok := userVal.(models.User)
		if !ok {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Internal Server Error: Invalid user context",
			})
		}

		// ADMIN has universal access
		if strings.EqualFold(user.Role, "ADMIN") {
			return c.Next()
		}

		for _, role := range allowedRoles {
			if strings.EqualFold(user.Role, role) {
				return c.Next()
			}
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":         "Forbidden: You do not have permission to access this resource",
			"requiredRoles": allowedRoles,
			"currentRole":   user.Role,
		})
	}
}

// RequireCourseTeacherOrAdmin ensures the user is ADMIN, ACADEMIC, or assigned teacher of the course
func RequireCourseTeacherOrAdmin(c *fiber.Ctx) error {
	user := GetCurrentUser(c)
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized: Please log in to continue",
		})
	}

	// Universal access for ADMIN and ACADEMIC
	if strings.EqualFold(user.Role, "ADMIN") || strings.EqualFold(user.Role, "ACADEMIC") {
		return c.Next()
	}

	courseIDStr := c.Params("id")
	if courseIDStr == "" {
		return c.Next()
	}

	courseID, err := uuid.Parse(courseIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid course ID",
		})
	}

	var course models.Course
	if err := database.DB.Where("id = ?", courseID).First(&course).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Course not found",
		})
	}

	// 1. Creator has full access
	if course.CreatedByID == user.ID {
		return c.Next()
	}

	// 2. Co-teachers have access
	var ct models.CourseTeacher
	if err := database.DB.Where("course_id = ? AND user_id = ?", courseID, user.ID).First(&ct).Error; err == nil {
		return c.Next()
	}

	// 3. Dept head has access to courses in their department
	if strings.EqualFold(user.Role, "DEPT_HEAD") && user.Department != "" && strings.EqualFold(user.Department, course.Department) {
		return c.Next()
	}

	return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
		"error": "Forbidden: ท่านไม่มีสิทธิ์เข้าถึงหรือแก้ไขข้อมูลรายวิชานี้ (เฉพาะครูผู้สอนหรือผู้ดูแลระบบ)",
	})
}

// GetCurrentUser helper retrieves user from locals
func GetCurrentUser(c *fiber.Ctx) *models.User {
	userVal := c.Locals("user")
	if userVal == nil {
		return nil
	}
	user, ok := userVal.(models.User)
	if !ok {
		return nil
	}
	return &user
}
