import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || 'tunorth-newtea-super-secret-key-2026-phase1',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  trustedOrigins: [
    'https://tea.tn.ac.th',
    'http://tea.local',
    'http://192.168.165.11:8010',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8010',
    'http://127.0.0.1:8010'
  ],
  database: new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      'postgres://tea_user:tea_password@localhost:5432/tunorth-tea_db?sslmode=disable'
  }),
  emailAndPassword: {
    enabled: true
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID)
    }
  },
  user: {
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'TEACHER',
        input: false
      },
      department: {
        type: 'string',
        required: false,
        input: false
      }
    }
  },
  session: {
    fields: {
      userId: 'user_id',
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent'
    }
  },
  account: {
    fields: {
      userId: 'user_id',
      accountId: 'account_id',
      providerId: 'provider_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  verification: {
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
})
