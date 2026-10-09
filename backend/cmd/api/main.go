package main

import (
	"log"
	"strings"

	"newtea-backend/internal/config"
	"newtea-backend/internal/database"
	"newtea-backend/internal/handlers"
	"newtea-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	cfg := config.LoadConfig()

	// Initialize Database with GORM & Auto Migrations
	_, err := database.InitDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Fatal: Database initialization failed: %v", err)
	}

	// Initialize Fiber App
	app := fiber.New(fiber.Config{
		AppName:      "NewTEA Backend API v1.0",
		ServerHeader: "Fiber",
		BodyLimit:    50 * 1024 * 1024, // 50MB for file uploads
	})

	// Middlewares
	app.Use(recover.New())
	app.Use(logger.New())

	// CORS Setup
	origins := strings.Join(strings.Split(cfg.AllowedOrigins, ","), ", ")
	app.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, Cookie, X-Session-Token",
		AllowMethods:     "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS",
		AllowCredentials: true,
	}))

	// Serve Static Uploads (PDFs, Images for Courses and Reports)
	app.Static("/uploads", "./uploads")

	// API Routes Group
	api := app.Group("/api")

	// ==========================================
	// 1. Public Routes
	// ==========================================
	api.Get("/health", handlers.HealthCheck)
	api.Get("/rooms", handlers.GetRooms)

	// Templates (both CSV with UTF-8 BOM and native Excel .xlsx)
	api.Get("/templates/students", handlers.GetStudentTemplate)
	api.Get("/templates/students.xlsx", handlers.GetStudentTemplateXlsx)
	api.Get("/templates/advisors", handlers.GetAdvisorTemplate)
	api.Get("/templates/advisors.xlsx", handlers.GetAdvisorTemplateXlsx)
	api.Get("/templates/users", handlers.GetUserTemplate)
	api.Get("/templates/users.xlsx", handlers.GetUserTemplateXlsx)

	// First Admin Bootstrap (Permitted if adminCount == 0, else requires ADMIN)
	api.Post("/users/setup-first-admin", middleware.OptionalAuthenticate, handlers.SetupFirstAdmin)

	// Public / Semi-Public with Optional Auth (Allows browsing with user context if present)
	api.Get("/courses", middleware.OptionalAuthenticate, handlers.GetCourses)
	api.Get("/courses/:id", middleware.OptionalAuthenticate, handlers.GetCourseByID)
	api.Get("/courses/:id/gradebook", middleware.OptionalAuthenticate, handlers.GetGradebook)
	api.Get("/advisors", middleware.OptionalAuthenticate, handlers.GetRoomAdvisors)
	api.Get("/settings/public", handlers.GetPublicSettings)

	// Auth routes fallback (Handled by Next.js frontend)
	api.All("/auth/*", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Authentication endpoints are handled by Next.js Better Auth frontend",
		})
	})

	// ==========================================
	// 2. Authenticated Routes (Any valid user)
	// ==========================================
	auth := api.Group("", middleware.Authenticate)

	// Current User Profile & Role Check
	auth.Get("/users/me", handlers.GetMe)

	// Advisor Dashboard
	auth.Get("/advisor/my-rooms", handlers.GetAdvisorRooms)
	auth.Get("/advisor/room/:roomId", handlers.GetAdvisorRoomDashboard)

	// Read Students & Terms
	auth.Get("/students", handlers.GetStudents)
	auth.Get("/students/:id", handlers.GetStudentByID)
	auth.Get("/terms", handlers.GetAcademicTerms)
	auth.Get("/terms/:id/milestones", handlers.GetMilestones)

	// Courses & Gradebook (Create & Verification Read)
	auth.Post("/courses", handlers.CreateCourse)
	auth.Get("/courses/:id/verifications", handlers.GetCourseVerifications)

	// ==========================================
	// 3. Course Owner / Co-Teacher / Admin Protected
	// ==========================================
	courseMgmt := auth.Group("/courses/:id", middleware.RequireCourseTeacherOrAdmin)
	courseMgmt.Put("", handlers.UpdateCourse)
	courseMgmt.Delete("", handlers.DeleteCourse)
	courseMgmt.Post("/co-teachers", handlers.AddCoTeacher)
	courseMgmt.Put("/teachers/:teacherId", handlers.UpdateCourseTeacherRooms)
	courseMgmt.Delete("/co-teachers/:teacherId", handlers.RemoveCoTeacher)

	// Gradebook Editing & Submission
	courseMgmt.Post("/columns", handlers.CreateScoreColumn)
	courseMgmt.Put("/columns/:colId", handlers.UpdateScoreColumn)
	courseMgmt.Delete("/columns/:colId", handlers.DeleteScoreColumn)
	courseMgmt.Post("/columns/reset", handlers.ResetScoreColumnsToDefault)
	courseMgmt.Post("/scores", handlers.BatchSaveScores)
	courseMgmt.Put("/evaluations/:evalId", handlers.UpdateStudentEvaluation)
	courseMgmt.Post("/evaluations/batch", handlers.BatchSaveEvaluations)
	courseMgmt.Post("/evaluations/auto-calculate", handlers.AutoCalculateEvaluations)
	courseMgmt.Put("/attendance-config", handlers.UpdateCourseAttendanceConfig)
	courseMgmt.Post("/attachments", handlers.UploadCourseAttachment)
	courseMgmt.Delete("/attachments/:type", handlers.DeleteCourseAttachment)
	courseMgmt.Post("/verifications/submit", handlers.SubmitCourseVerification)
	courseMgmt.Post("/verifications/request-unlock", handlers.RequestCourseUnlock)

	// Unlock Request Decisions (Dept Head, Academic, Admin)
	auth.Post("/courses/:id/verifications/approve-unlock", handlers.ApproveCourseUnlock)
	auth.Post("/courses/:id/verifications/reject-unlock", handlers.RejectCourseUnlock)

	// ==========================================
	// 4. Department Head & Admin Routes (ADMIN, DEPT_HEAD)
	// ==========================================
	deptHead := auth.Group("", middleware.RequireRole("ADMIN", "DEPT_HEAD"))
	deptHead.Get("/dept-head/courses", handlers.GetDeptHeadCourses)
	deptHead.Post("/courses/:id/verifications/dept-head", handlers.ReviewDeptHeadVerification)

	// ==========================================
	// 5. Academic Affairs & Admin Routes (ADMIN, ACADEMIC)
	// ==========================================
	academic := auth.Group("", middleware.RequireRole("ADMIN", "ACADEMIC"))
	academic.Get("/academic/overview", handlers.GetAcademicOverview)
	academic.Post("/courses/:id/verifications/academic", handlers.ReviewAcademicVerification)
	academic.Post("/courses/:id/verifications/sgs", handlers.ToggleSGSTransferred)

	// Students Management (Mutations)
	academic.Post("/students", handlers.CreateStudent)
	academic.Put("/students/:id", handlers.UpdateStudent)
	academic.Delete("/students/:id", handlers.DeleteStudent)
	academic.Patch("/students/:id/status", handlers.UpdateStudentStatus)
	academic.Post("/students/import", handlers.ImportStudents)
	academic.Post("/students/bulk-delete", handlers.BulkDeleteStudents)
	academic.Post("/students/delete-by-scope", handlers.DeleteStudentsByScope)

	// Year-End Rollover & Promotion (Academic Year Transition)
	academic.Get("/students/rollover/preview", handlers.GetRolloverPreview)
	academic.Post("/students/rollover/graduate-m6", handlers.GraduateM6Students)
	academic.Post("/students/rollover/promote", handlers.PromoteStudents)

	// Academic Terms & Milestones Management
	academic.Post("/terms", handlers.CreateAcademicTerm)
	academic.Put("/terms/:id", handlers.UpdateAcademicTerm)
	academic.Delete("/terms/:id", handlers.DeleteAcademicTerm)
	academic.Patch("/terms/:id/activate", handlers.ActivateAcademicTerm)
	academic.Put("/terms/:id/milestones", handlers.UpdateMilestones)
	academic.Post("/terms/:id/milestones", handlers.CreateMilestone)
	academic.Delete("/terms/:id/milestones/:milestoneId", handlers.DeleteMilestone)
	academic.Post("/terms/:id/milestones/reset", handlers.ResetMilestones)

	// ==========================================
	// 6. System Administrator Only Routes (ADMIN)
	// ==========================================
	admin := auth.Group("", middleware.RequireRole("ADMIN"))

	// Advisors Assignment & Import
	admin.Post("/advisors", handlers.CreateOrAssignAdvisor)
	admin.Put("/advisors/:id", handlers.UpdateAdvisor)
	admin.Delete("/advisors/:id", handlers.DeleteAdvisor)
	admin.Post("/advisors/import", handlers.ImportAdvisors)

	// Classroom Management (Add & Remove Rooms)
	admin.Post("/rooms", handlers.CreateRoom)
	admin.Delete("/rooms/:id", handlers.DeleteRoom)

	// System Settings & Assessment Criteria
	admin.Get("/settings", handlers.GetAllSettings)
	admin.Put("/settings", handlers.UpdateSystemSettings)
	admin.Post("/settings/upload-image", handlers.UploadSettingImage)
	admin.Get("/settings/assessment-criteria", handlers.GetAssessmentCriteria)
	admin.Put("/settings/assessment-criteria", handlers.UpdateAssessmentCriteria)

	// User & Role Management (RBAC & Full CRUD & Import)
	admin.Get("/users", handlers.GetUsers)
	admin.Get("/users/template", handlers.GetUserTemplate)
	admin.Get("/users/template.xlsx", handlers.GetUserTemplateXlsx)
	admin.Post("/users", handlers.CreateUser)
	admin.Post("/users/import", handlers.ImportUsers)
	admin.Put("/users/:id", handlers.UpdateUser)
	admin.Delete("/users/:id", handlers.DeleteUser)
	admin.Post("/users/:id/reset-password", handlers.ResetUserPassword)
	admin.Patch("/users/:id/role", handlers.UpdateUserRole)
	admin.Patch("/users/:id/department", handlers.UpdateUserDepartment)

	log.Printf("NewTEA Backend running on port %s (Allowed Origins: %s)", cfg.Port, origins)
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("Server shutdown with error: %v", err)
	}
}
