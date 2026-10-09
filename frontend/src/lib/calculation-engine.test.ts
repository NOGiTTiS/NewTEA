import { describe, expect, it } from 'bun:test'
import {
  calculateStandardGrade,
  checkAttendanceStatus,
  calculateAttendancePercentage,
  calculateAuto3DAssessment,
  calculateWeightedTotalScore,
  evaluateStudent,
  mapGradeToAspectLevel,
  generateSubscores,
  generateDesirableSubscores,
  calculateSummaryGradeFromSubscores,
  isScoreBelowThreshold,
  getDesirableLabel,
  getReadingLabel,
  getCompetencyItemLabel,
  getCompetencySummaryLabel,
  formatAutoSGSText,
  ScoreColumnDefinition,
  AssessmentCriteriaConfig,
  ExportStudentData
} from './calculation-engine'

describe('Calculation Engine - Standard Grade (0 - 4)', () => {
  it('correctly maps 80-100 to grade 4', () => {
    expect(calculateStandardGrade(100)).toBe('4')
    expect(calculateStandardGrade(85)).toBe('4')
    expect(calculateStandardGrade(80)).toBe('4')
    expect(calculateStandardGrade(79.995)).toBe('4') // Rounds to 80.00
  })

  it('correctly maps 75-79.99 to grade 3.5', () => {
    expect(calculateStandardGrade(79.4)).toBe('3.5')
    expect(calculateStandardGrade(75)).toBe('3.5')
  })

  it('correctly maps 70-74.99 to grade 3', () => {
    expect(calculateStandardGrade(74.9)).toBe('3')
    expect(calculateStandardGrade(70)).toBe('3')
  })

  it('correctly maps 65-69.99 to grade 2.5', () => {
    expect(calculateStandardGrade(69.5)).toBe('2.5')
    expect(calculateStandardGrade(65)).toBe('2.5')
  })

  it('correctly maps 60-64.99 to grade 2', () => {
    expect(calculateStandardGrade(64)).toBe('2')
    expect(calculateStandardGrade(60)).toBe('2')
  })

  it('correctly maps 55-59.99 to grade 1.5', () => {
    expect(calculateStandardGrade(59)).toBe('1.5')
    expect(calculateStandardGrade(55)).toBe('1.5')
  })

  it('correctly maps 50-54.99 to grade 1', () => {
    expect(calculateStandardGrade(54)).toBe('1')
    expect(calculateStandardGrade(50)).toBe('1')
  })

  it('correctly maps <50 to grade 0', () => {
    expect(calculateStandardGrade(49.9)).toBe('0')
    expect(calculateStandardGrade(30)).toBe('0')
    expect(calculateStandardGrade(0)).toBe('0')
  })
})

describe('Calculation Engine - Attendance Check (<80% -> มส)', () => {
  it('triggers มส when attendance is below 80%', () => {
    const res = checkAttendanceStatus(79.9)
    expect(res.isMs).toBe(true)
    expect(res.specialGrade).toBe('มส')
  })

  it('does not trigger มส when attendance is 80% or above', () => {
    const res80 = checkAttendanceStatus(80.0)
    expect(res80.isMs).toBe(false)
    expect(res80.specialGrade).toBeUndefined()

    const res100 = checkAttendanceStatus(100.0)
    expect(res100.isMs).toBe(false)
  })

  it('clears previous มส if attendance is updated to >= 80%', () => {
    const res = checkAttendanceStatus(85.0, 'มส')
    expect(res.isMs).toBe(false)
    expect(res.specialGrade).toBeUndefined()
  })
})

describe('Calculation Engine - Two-Period Attendance Calculation', () => {
  it('calculates 100% attendance when student attends all hours in both periods', () => {
    // 20/20 in P1 + 20/20 in P2 = 40/40 = 100%
    const res = calculateAttendancePercentage(20, 20, 20, 20)
    expect(res.totalAttendedHours).toBe(40)
    expect(res.maxTotalHours).toBe(40)
    expect(res.attendancePercentage).toBe(100)
    expect(res.isMs).toBe(false)
  })

  it('calculates percentage correctly and does not trigger มส when attendance >= 80%', () => {
    // 18/20 in P1 + 15/20 in P2 = 33/40 = 82.5%
    const res = calculateAttendancePercentage(18, 15, 20, 20)
    expect(res.totalAttendedHours).toBe(33)
    expect(res.maxTotalHours).toBe(40)
    expect(res.attendancePercentage).toBe(82.5)
    expect(res.isMs).toBe(false)
  })

  it('treats exactly 80.0% boundary as passing (no มส)', () => {
    // 16/20 in P1 + 16/20 in P2 = 32/40 = 80.0%
    const res = calculateAttendancePercentage(16, 16, 20, 20)
    expect(res.totalAttendedHours).toBe(32)
    expect(res.maxTotalHours).toBe(40)
    expect(res.attendancePercentage).toBe(80)
    expect(res.isMs).toBe(false)
  })

  it('triggers มส when attendance falls below 80%', () => {
    // 15/20 in P1 + 15/20 in P2 = 30/40 = 75.0%
    const res = calculateAttendancePercentage(15, 15, 20, 20)
    expect(res.totalAttendedHours).toBe(30)
    expect(res.maxTotalHours).toBe(40)
    expect(res.attendancePercentage).toBe(75)
    expect(res.isMs).toBe(true)
  })

  it('handles unequal max hours per period (e.g. 25 + 15 = 40)', () => {
    // 22/25 in P1 + 12/15 in P2 = 34/40 = 85.0%
    const res = calculateAttendancePercentage(22, 12, 25, 15)
    expect(res.totalAttendedHours).toBe(34)
    expect(res.maxTotalHours).toBe(40)
    expect(res.attendancePercentage).toBe(85)
    expect(res.isMs).toBe(false)
  })

  it('safely handles 0 hours or invalid values', () => {
    const resZero = calculateAttendancePercentage(0, 0, 20, 20)
    expect(resZero.totalAttendedHours).toBe(0)
    expect(resZero.attendancePercentage).toBe(0)
    expect(resZero.isMs).toBe(true)

    const resNoMax = calculateAttendancePercentage(10, 10, 0, 0)
    expect(resNoMax.attendancePercentage).toBe(100)
    expect(resNoMax.isMs).toBe(false)
  })
})

describe('Calculation Engine - Auto-Map 3D Assessment', () => {
  it('maps grades 2 to 4 to level 3 (ดีเยี่ยม)', () => {
    for (const g of ['4', '3.5', '3', '2.5', '2']) {
      const res = calculateAuto3DAssessment(g)
      expect(res.desirableGrade).toBe(3)
      expect(res.readingGrade).toBe(3)
      expect(res.competencyGrade).toBe(3)
    }
  })

  it('maps grades 1 to 1.5 to level 2 (ดี)', () => {
    for (const g of ['1.5', '1']) {
      const res = calculateAuto3DAssessment(g)
      expect(res.desirableGrade).toBe(2)
      expect(res.readingGrade).toBe(2)
      expect(res.competencyGrade).toBe(2)
    }
  })

  it('maps grade 0 to level 1 (ผ่าน)', () => {
    const res = calculateAuto3DAssessment('0')
    expect(res.desirableGrade).toBe(1)
    expect(res.readingGrade).toBe(1)
    expect(res.competencyGrade).toBe(1)
  })

  it('maps special grade มส or ร to level 1 (ผ่าน / พอใช้)', () => {
    const resMs = calculateAuto3DAssessment('0', 'มส')
    expect(resMs.desirableGrade).toBe(1)
    expect(resMs.readingGrade).toBe(1)
    expect(resMs.competencyGrade).toBe(1)

    const resR = calculateAuto3DAssessment('0', 'ร')
    expect(resR.desirableGrade).toBe(1)
    expect(resR.readingGrade).toBe(1)
    expect(resR.competencyGrade).toBe(1)
  })
})

describe('Calculation Engine - Weighted Score Normalization', () => {
  const columns: ScoreColumnDefinition[] = [
    { id: 'c1', name: 'งาน 1', maxScore: 25, weight: 25, periodType: 1 },
    { id: 'c2', name: 'กลางภาค', maxScore: 20, weight: 20, periodType: 2 },
    { id: 'c3', name: 'งาน 2', maxScore: 25, weight: 25, periodType: 3 },
    { id: 'c4', name: 'ปลายภาค', maxScore: 30, weight: 30, periodType: 4 }
  ]

  it('calculates perfect score as 100', () => {
    const scores = { c1: 25, c2: 20, c3: 25, c4: 30 }
    const total = calculateWeightedTotalScore(scores, {}, columns)
    expect(total).toBe(100)
  })

  it('normalizes when raw score is out of different maxScore', () => {
    const customCols: ScoreColumnDefinition[] = [
      { id: 'c1', name: 'สอบย่อย', maxScore: 50, weight: 20, periodType: 1 }
    ]
    // 25 out of 50 = 50% * 20 weight = 10
    const total = calculateWeightedTotalScore({ c1: 25 }, {}, customCols)
    expect(total).toBe(10)
  })

  it('skips absent columns (isAbsent = true)', () => {
    const scores = { c1: 25, c2: 20, c3: 25, c4: 30 }
    const absentMap = { c4: true }
    const total = calculateWeightedTotalScore(scores, absentMap, columns)
    expect(total).toBe(70)
  })
})

describe('Calculation Engine - Consolidated Evaluation & Override', () => {
  const columns: ScoreColumnDefinition[] = [
    { id: 'c1', name: 'งาน 1', maxScore: 25, weight: 25, periodType: 1 },
    { id: 'c2', name: 'กลางภาค', maxScore: 20, weight: 20, periodType: 2 },
    { id: 'c3', name: 'งาน 2', maxScore: 25, weight: 25, periodType: 3 },
    { id: 'c4', name: 'ปลายภาค', maxScore: 30, weight: 30, periodType: 4 }
  ]

  it('evaluates student with score 82 as Grade 4 and 3D level 3', () => {
    const res = evaluateStudent({
      scores: { c1: 20, c2: 17, c3: 20, c4: 25 }, // total = 82
      absentMap: {},
      columns,
      attendancePercentage: 95
    })
    expect(res.totalScore).toBe(82)
    expect(res.grade).toBe('4')
    expect(res.isMs).toBe(false)
    expect(res.desirableGrade).toBe(3)
  })

  it('evaluates student with attendance < 80% as มส and Grade 0', () => {
    const res = evaluateStudent({
      scores: { c1: 25, c2: 20, c3: 25, c4: 30 }, // total = 100
      absentMap: {},
      columns,
      attendancePercentage: 75
    })
    expect(res.totalScore).toBe(100)
    expect(res.isMs).toBe(true)
    expect(res.specialGrade).toBe('มส')
    expect(res.grade).toBe('0')
    expect(res.desirableGrade).toBe(1)
  })

  it('honors teacher override for 3D assessments', () => {
    const res = evaluateStudent({
      scores: { c1: 25, c2: 20, c3: 25, c4: 30 },
      absentMap: {},
      columns,
      attendancePercentage: 90,
      isOverridden: true,
      overrideDesirable: 2,
      overrideReading: 2,
      overrideCompetency: 2
    })
    expect(res.grade).toBe('4')
    expect(res.desirableGrade).toBe(2)
    expect(res.readingGrade).toBe(2)
    expect(res.competencyGrade).toBe(2)
  })
})

describe('Calculation Engine - 3D Subscores and Admin Criteria', () => {
  it('generates correct subscore array lengths (8, 5, 5)', () => {
    const res = calculateAuto3DAssessment('3')
    expect(res.desirableSubscores.length).toBe(8)
    expect(res.desirableSubscores).toEqual([3, 3, 3, 3, 3, 3, 3, 3])

    expect(res.readingSubscores.length).toBe(5)
    expect(res.readingSubscores).toEqual([3, 3, 3, 3, 3])

    expect(res.competencySubscores.length).toBe(5)
    expect(res.competencySubscores).toEqual([3, 3, 3, 3, 3])
  })

  it('maps custom criteria thresholds correctly', () => {
    const customCriteria: AssessmentCriteriaConfig = {
      mode: 'GRADE_BASED',
      desirable: {
        name: 'คุณลักษณะอันพึงประสงค์',
        itemCount: 8,
        excellentMinGrade: 3.0, // Stricter: requires >= 3.0
        goodMinGrade: 2.0,
        passMinGrade: 1.0,
        defaultLevel: 3
      },
      reading: {
        name: 'การอ่าน คิดวิเคราะห์',
        itemCount: 5,
        excellentMinGrade: 2.5,
        goodMinGrade: 1.5,
        passMinGrade: 1.0,
        defaultLevel: 3
      },
      competency: {
        name: 'สมรรถนะสำคัญ',
        itemCount: 5,
        excellentMinGrade: 2.0,
        goodMinGrade: 1.0,
        passMinGrade: 0.0,
        defaultLevel: 3
      },
      specialGradeRules: {
        msLevel: 0,
        rLevel: 0
      }
    }

    // Grade 2.5:
    // desirable: goodMinGrade is 2.0 <= 2.5 < 3.0 -> level 2
    // reading: excellentMinGrade is 2.5 <= 2.5 -> level 3
    // competency: excellentMinGrade is 2.0 <= 2.5 -> level 3
    const res = calculateAuto3DAssessment('2.5', undefined, customCriteria)
    expect(res.desirableGrade).toBe(2)
    expect(res.desirableSubscores).toEqual([3, 3, 2, 2, 2, 2, 2, 3])
    expect(res.readingGrade).toBe(3)
    expect(res.competencyGrade).toBe(3)
  })

  it('keeps desirable items 1, 2, 8 at level 3 (ดีเยี่ยม) across all academic grades', () => {
    const grades = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0']
    for (const g of grades) {
      const res = calculateAuto3DAssessment(g)
      expect(res.desirableSubscores[0]).toBe(3) // ข้อ 1: รักชาติ ศาสน์ กษัตริย์
      expect(res.desirableSubscores[1]).toBe(3) // ข้อ 2: ซื่อสัตย์สุจริต
      expect(res.desirableSubscores[7]).toBe(3) // ข้อ 8: มีจิตสาธารณะ
    }

    // Grade 1.5 -> dLevel 2
    const res15 = calculateAuto3DAssessment('1.5')
    expect(res15.desirableSubscores).toEqual([3, 3, 2, 2, 2, 2, 2, 3])

    // Grade 0 -> dLevel 1
    const res0 = calculateAuto3DAssessment('0')
    expect(res0.desirableSubscores).toEqual([3, 3, 1, 1, 1, 1, 1, 3])

    // Special grade มส
    const resMs = calculateAuto3DAssessment('0', 'มส')
    expect(resMs.desirableSubscores).toEqual([3, 3, 1, 1, 1, 1, 1, 3])

    // Special grade ร
    const resR = calculateAuto3DAssessment('0', 'ร')
    expect(resR.desirableSubscores).toEqual([3, 3, 1, 1, 1, 1, 1, 3])
  })

  it('calculates summary grade from subscores', () => {
    expect(calculateSummaryGradeFromSubscores([3, 3, 3, 3, 3])).toBe(3)
    expect(calculateSummaryGradeFromSubscores([2, 2, 2, 2, 2])).toBe(2)
    expect(calculateSummaryGradeFromSubscores([1, 1, 1, 1, 1])).toBe(1)
    expect(calculateSummaryGradeFromSubscores([0, 0, 0, 0, 0])).toBe(0)
    // Mixed: average 2.6 -> 3
    expect(calculateSummaryGradeFromSubscores([3, 3, 3, 2, 2])).toBe(3)
    // Mixed: average 2.2 -> 2
    expect(calculateSummaryGradeFromSubscores([3, 2, 2, 2, 2])).toBe(2)
  })
})

describe('Calculation Engine - 60% Passing Threshold Validation', () => {
  it('correctly identifies scores below 60% for periodType 1 (ก่อนกลางภาค)', () => {
    // maxScore = 10, threshold = 6.0
    expect(isScoreBelowThreshold(5.5, 10, 1)).toBe(true)
    expect(isScoreBelowThreshold(5.9, 10, 1)).toBe(true)
    expect(isScoreBelowThreshold(6.0, 10, 1)).toBe(false)
    expect(isScoreBelowThreshold(10, 10, 1)).toBe(false)
  })

  it('correctly identifies scores below 60% for periodType 2 (กลางภาค)', () => {
    // maxScore = 20, threshold = 12.0
    expect(isScoreBelowThreshold(11.5, 20, 2)).toBe(true)
    expect(isScoreBelowThreshold(12.0, 20, 2)).toBe(false)
    expect(isScoreBelowThreshold(15, 20, 2)).toBe(false)
  })

  it('correctly identifies scores below 60% for periodType 3 (หลังกลางภาค)', () => {
    // maxScore = 10, threshold = 6.0
    expect(isScoreBelowThreshold(5, 10, 3)).toBe(true)
    expect(isScoreBelowThreshold(6, 10, 3)).toBe(false)
  })

  it('does not flag scores for periodType 4 (ปลายภาค)', () => {
    // maxScore = 20, score = 10 (periodType 4 does not apply)
    expect(isScoreBelowThreshold(10, 20, 4)).toBe(false)
  })

  it('does not flag absent students or undefined scores', () => {
    expect(isScoreBelowThreshold(0, 10, 1, true)).toBe(false)
    expect(isScoreBelowThreshold(undefined, 10, 1)).toBe(false)
  })
})

describe('Calculation Engine - Label Helpers', () => {
  it('returns correct desirable labels (ดีเยี่ยม, ดี, ผ่าน, ไม่ผ่าน)', () => {
    expect(getDesirableLabel(3)).toBe('ดีเยี่ยม')
    expect(getDesirableLabel(2)).toBe('ดี')
    expect(getDesirableLabel(1)).toBe('ผ่าน')
    expect(getDesirableLabel(0)).toBe('ไม่ผ่าน')
  })

  it('returns correct reading labels (ดีเยี่ยม, ดี, ผ่าน, ไม่ผ่าน)', () => {
    expect(getReadingLabel(3)).toBe('ดีเยี่ยม')
    expect(getReadingLabel(2)).toBe('ดี')
    expect(getReadingLabel(1)).toBe('ผ่าน')
    expect(getReadingLabel(0)).toBe('ไม่ผ่าน')
  })

  it('returns correct competency item labels (ดีมาก, ดี, ปรับปรุง)', () => {
    expect(getCompetencyItemLabel(3)).toBe('ดีมาก')
    expect(getCompetencyItemLabel(2)).toBe('ดี')
    expect(getCompetencyItemLabel(1)).toBe('ปรับปรุง')
    expect(getCompetencyItemLabel(0)).toBe('ปรับปรุง')
  })

  it('returns correct competency summary labels (ดีเยี่ยม, ดี, พอใช้, ปรับปรุง)', () => {
    expect(getCompetencySummaryLabel(3)).toBe('ดีเยี่ยม')
    expect(getCompetencySummaryLabel(2)).toBe('ดี')
    expect(getCompetencySummaryLabel(1)).toBe('พอใช้')
    expect(getCompetencySummaryLabel(0)).toBe('ปรับปรุง')
  })
})

describe('Calculation Engine - AutoSGS Clipboard Export Formatting', () => {
  const sampleCols: ScoreColumnDefinition[] = [
    { id: 'c1', name: 'ก่อนกลาง 1', maxScore: 10, weight: 10, periodType: 1, sequence: 1 },
    { id: 'c2', name: 'ก่อนกลาง 2', maxScore: 10, weight: 10, periodType: 1, sequence: 2 },
    { id: 'c3', name: 'สอบกลางภาค', maxScore: 20, weight: 20, periodType: 2, sequence: 3 },
    { id: 'c4', name: 'หลังกลาง 1', maxScore: 10, weight: 10, periodType: 3, sequence: 4 },
    { id: 'c5', name: 'สอบปลายภาค', maxScore: 20, weight: 20, periodType: 4, sequence: 5 }
  ]

  const sampleStudents: ExportStudentData[] = [
    {
      scores: { c1: 10, c2: 9.5, c3: 18, c4: 10, c5: 19 },
      absentMap: {},
      parsedDesirableSubscores: [3, 3, 3, 3, 3, 3, 3, 3],
      parsedReadingSubscores: [3, 3, 3, 3, 3]
    },
    {
      scores: { c1: 8, c2: 7, c3: 0, c4: 8, c5: 15 },
      absentMap: { c3: true },
      parsedDesirableSubscores: [3, 3, 2, 2, 2, 2, 2, 3],
      parsedReadingSubscores: [2, 2, 2, 2, 2]
    }
  ]

  it('correctly exports SCORES_MIDTERM containing only periodType 1 and 2 with header', () => {
    const tsv = formatAutoSGSText('SCORES_MIDTERM', sampleStudents, sampleCols)
    const lines = tsv.split('\n')
    expect(lines.length).toBe(3)
    expect(lines[0]).toBe('# Source: NewTEA | Rows: 2')
    // Student 1: c1 (10), c2 (9.5), c3 (18)
    expect(lines[1]).toBe('10\t9.5\t18')
    // Student 2: c1 (8), c2 (7), c3 (absent -> ข)
    expect(lines[2]).toBe('8\t7\tข')
  })

  it('correctly exports SCORES_FINAL containing only periodType 3 and 4 with header', () => {
    const tsv = formatAutoSGSText('SCORES_FINAL', sampleStudents, sampleCols)
    const lines = tsv.split('\n')
    expect(lines.length).toBe(3)
    expect(lines[0]).toBe('# Source: NewTEA | Rows: 2')
    // Student 1: c4 (10), c5 (19)
    expect(lines[1]).toBe('10\t19')
    // Student 2: c4 (8), c5 (15)
    expect(lines[2]).toBe('8\t15')
  })

  it('correctly exports DESIRABLE with 8 items and 4 trailing tabs with header', () => {
    const tsv = formatAutoSGSText('DESIRABLE', sampleStudents, sampleCols)
    const lines = tsv.split('\n')
    expect(lines.length).toBe(3)
    expect(lines[0]).toBe('# Source: NewTEA | Rows: 2')
    expect(lines[1]).toBe('3\t3\t3\t3\t3\t3\t3\t3\t\t\t\t')
    expect(lines[2]).toBe('3\t3\t2\t2\t2\t2\t2\t3\t\t\t\t')
  })

  it('correctly exports READING with 5 items and 3 trailing tabs with header', () => {
    const tsv = formatAutoSGSText('READING', sampleStudents, sampleCols)
    const lines = tsv.split('\n')
    expect(lines.length).toBe(3)
    expect(lines[0]).toBe('# Source: NewTEA | Rows: 2')
    expect(lines[1]).toBe('3\t3\t3\t3\t3\t\t\t')
    expect(lines[2]).toBe('2\t2\t2\t2\t2\t\t\t')
  })

  it('preserves exact student count even when trailing students have no scores', () => {
    const fiveStudents = [
      ...sampleStudents,
      { scores: {}, absentMap: {} },
      { scores: {}, absentMap: {} },
      { scores: {}, absentMap: {} }
    ]
    const tsv = formatAutoSGSText('SCORES_MIDTERM', fiveStudents, sampleCols)
    const lines = tsv.split('\n')
    expect(lines.length).toBe(6) // 1 header + 5 student rows
    expect(lines[0]).toBe('# Source: NewTEA | Rows: 5')
    expect(lines[1]).toBe('10\t9.5\t18')
    expect(lines[2]).toBe('8\t7\tข')
    expect(lines[3]).toBe('\t\t')
    expect(lines[4]).toBe('\t\t')
    expect(lines[5]).toBe('\t\t')
  })

  it('handles empty students array gracefully', () => {
    expect(formatAutoSGSText('SCORES_MIDTERM', [], sampleCols)).toBe('')
  })
})

