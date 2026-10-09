import { describe, expect, it } from 'bun:test'

describe('Verification & Approval Workflow Lifecycle', () => {
  type VerificationState = {
    round: number
    teacherSubmitted: boolean
    deptHeadStatus: 'PENDING' | 'APPROVED' | 'REVISE'
    academicStatus: 'PENDING' | 'APPROVED' | 'REVISE'
    sgsTransferred: boolean
    unlockRequested: boolean
    unlockReason?: string
    unlockApprovedBy?: string
  }

  const isGradebookLocked = (state: VerificationState): boolean => {
    // If revision was requested, gradebook unlocks for teacher
    if (state.deptHeadStatus === 'REVISE' || state.academicStatus === 'REVISE') {
      return false
    }
    // If unlock request was approved, it is unlocked
    if (state.unlockApprovedBy && !state.teacherSubmitted) {
      return false
    }
    // Otherwise locked if teacher submitted
    return state.teacherSubmitted
  }

  it('allows editing before submission', () => {
    const round1: VerificationState = {
      round: 1,
      teacherSubmitted: false,
      deptHeadStatus: 'PENDING',
      academicStatus: 'PENDING',
      sgsTransferred: false,
      unlockRequested: false
    }
    expect(isGradebookLocked(round1)).toBe(false)
  })

  it('locks gradebook immediately upon teacher submission', () => {
    const round1: VerificationState = {
      round: 1,
      teacherSubmitted: true,
      deptHeadStatus: 'PENDING',
      academicStatus: 'PENDING',
      sgsTransferred: false,
      unlockRequested: false
    }
    expect(isGradebookLocked(round1)).toBe(true)
  })

  it('unlocks gradebook when department head or academic requests revision', () => {
    const round2: VerificationState = {
      round: 2,
      teacherSubmitted: true,
      deptHeadStatus: 'REVISE',
      academicStatus: 'PENDING',
      sgsTransferred: false,
      unlockRequested: false
    }
    expect(isGradebookLocked(round2)).toBe(false)
  })

  it('keeps gradebook locked after approval until unlock request is approved', () => {
    const round3: VerificationState = {
      round: 3,
      teacherSubmitted: true,
      deptHeadStatus: 'APPROVED',
      academicStatus: 'APPROVED',
      sgsTransferred: true,
      unlockRequested: true,
      unlockReason: 'นักเรียนส่งงานแก้ 0'
    }
    // Still locked while pending unlock review
    expect(isGradebookLocked(round3)).toBe(true)

    // When admin/academic approves unlock
    round3.teacherSubmitted = false
    round3.deptHeadStatus = 'REVISE'
    round3.unlockApprovedBy = 'นายวิชาการ ทดสอบ'
    round3.unlockRequested = false

    expect(isGradebookLocked(round3)).toBe(false)
  })
})
