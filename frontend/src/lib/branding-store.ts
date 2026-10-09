'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface BrandingState {
  systemName: string
  schoolName: string
  schoolAddress: string
  siteLogo: string
  siteFavicon: string
  siteCopyright: string
  setBranding: (branding: Partial<BrandingState>) => void
}

export const useBrandingStore = create<BrandingState>()(
  persist(
    (set) => ({
      systemName: 'NewTEA - Triam Evaluation & Assessment',
      schoolName: 'โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ',
      schoolAddress: 'ตำบลหัวรอ อำเภอเมืองพิษณุโลก จังหวัดพิษณุโลก',
      siteLogo: '',
      siteFavicon: '',
      siteCopyright: '© 2026 โรงเรียนเตรียมอุดมศึกษา ภาคเหนือ. All rights reserved.',
      setBranding: (branding) => set((state) => ({ ...state, ...branding }))
    }),
    {
      name: 'tea_branding_store'
    }
  )
)
