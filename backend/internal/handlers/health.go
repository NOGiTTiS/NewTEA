package handlers

import (
	"newtea-backend/internal/database"
	"newtea-backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

type HealthResponse struct {
	Status    string `json:"status"`
	Version   string `json:"version"`
	Phase     string `json:"phase"`
	Database  string `json:"database"`
	RoomCount int64  `json:"roomCount"`
}

func HealthCheck(c *fiber.Ctx) error {
	var roomCount int64
	dbStatus := "connected"
	if database.DB != nil {
		if err := database.DB.Model(&models.Room{}).Count(&roomCount).Error; err != nil {
			dbStatus = "error: " + err.Error()
		}
	} else {
		dbStatus = "disconnected"
	}

	return c.JSON(HealthResponse{
		Status:    "ok",
		Version:   "1.0.0",
		Phase:     "Phase 1: Foundation & Core Infrastructure",
		Database:  dbStatus,
		RoomCount: roomCount,
	})
}
