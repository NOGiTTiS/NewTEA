'use client'

import * as React from 'react'
import { RoleGuard } from '@/components/role-guard'

export default function AdminLayout({
  children
}: {
  children: React.ReactNode
}) {
  return <RoleGuard allowedRoles={['ADMIN', 'ACADEMIC']}>{children}</RoleGuard>
}
