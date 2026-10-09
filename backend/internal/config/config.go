package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port             string
	DatabaseURL      string
	AllowedOrigins   string
	BetterAuthSecret string
}

func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("BACKEND_PORT")
	}
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		host := os.Getenv("DB_HOST")
		if host == "" {
			host = "localhost"
		}
		port := os.Getenv("DB_PORT")
		if port == "" {
			port = "5432"
		}
		user := os.Getenv("DB_USER")
		if user == "" {
			user = os.Getenv("POSTGRES_USER")
		}
		if user == "" {
			user = "tea_user"
		}
		pass := os.Getenv("DB_PASSWORD")
		if pass == "" {
			pass = os.Getenv("POSTGRES_PASSWORD")
		}
		if pass == "" {
			pass = "tea_password"
		}
		name := os.Getenv("DB_NAME")
		if name == "" {
			name = os.Getenv("POSTGRES_DB")
		}
		if name == "" {
			name = "tunorth-tea_db"
		}
		sslmode := os.Getenv("DB_SSLMODE")
		if sslmode == "" {
			sslmode = "disable"
		}
		dbURL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s", user, pass, host, port, name, sslmode)
	}

	origins := os.Getenv("ALLOWED_ORIGINS")
	if origins == "" {
		origins = "https://tea.tn.ac.th,http://tea.local,http://192.168.165.11:8010,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8010"
	}

	authSecret := os.Getenv("BETTER_AUTH_SECRET")
	if authSecret == "" {
		authSecret = "tunorth-newtea-super-secret-key-2026-phase1"
	}

	return &Config{
		Port:             port,
		DatabaseURL:      dbURL,
		AllowedOrigins:   origins,
		BetterAuthSecret: authSecret,
	}
}
