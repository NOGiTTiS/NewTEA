export interface ScoreColumnDefinition {
  id: string
  name: string
  maxScore: number
  weight: number
  periodType: number
  sequence?: number
}

export interface StudentScoreInput {
  score: number
  isAbsent?: boolean
}

export interface AssessmentAspectCriteria {
  name: string
  itemCount: number
  excellentMinGrade: number
  goodMinGrade: number
  passMinGrade: number
  defaultLevel: number
}

export interface SpecialGradeCriteria {
  msLevel: number
  rLevel: number
}

export interface AssessmentCriteriaConfig {
  mode: string
  desirable: AssessmentAspectCriteria
  reading: AssessmentAspectCriteria
  competency: AssessmentAspectCriteria
  specialGradeRules: SpecialGradeCriteria
}

export const DEFAULT_ASSESSMENT_CRITERIA: AssessmentCriteriaConfig = {
  mode: 'GRADE_BASED',
  desirable: {
    name: 'คุณลักษณะอันพึงประสงค์',
    itemCount: 8,
    excellentMinGrade: 2.0,
    goodMinGrade: 1.0,
    passMinGrade: 0.0,
    defaultLevel: 3
  },
  reading: {
    name: 'การอ่าน คิดวิเคราะห์ และเขียน',
    itemCount: 5,
    excellentMinGrade: 2.0,
    goodMinGrade: 1.0,
    passMinGrade: 0.0,
    defaultLevel: 3
  },
  competency: {
    name: 'สมรรถนะสำคัญของผู้เรียน',
    itemCount: 5,
    excellentMinGrade: 2.0,
    goodMinGrade: 1.0,
    passMinGrade: 0.0,
    defaultLevel: 3
  },
  specialGradeRules: {
    msLevel: 1,
    rLevel: 1
  }
}

export const DESIRABLE_ITEMS = [
  'รักชาติ ศาสน์ กษัตริย์',
  'ซื่อสัตย์สุจริต',
  'มีวินัย',
  'ใฝ่เรียนรู้',
  'อยู่อย่างพอเพียง',
  'มุ่งมั่นในการทำงาน',
  'รักความเป็นไทย',
  'มีจิตสาธารณะ'
] as const

export const READING_ITEMS = [
  'การอ่านและทำความเข้าใจ',
  'การคิดวิเคราะห์และสรุปประเด็น',
  'การเชื่อมโยงความสัมพันธ์และความสมเหตุสมผล',
  'การแสดงความคิดเห็นและประเมินค่า',
  'การสื่อสารและการถ่ายทอดความคิด'
] as const

export const COMPETENCY_ITEMS = [
  'ความสามารถในการสื่อสาร',
  'ความสามารถในการคิด',
  'ความสามารถในการแก้ปัญหา',
  'ความสามารถในการใช้ทักษะชีวิต',
  'ความสามารถในการใช้เทคโนโลยี'
] as const

export interface EvaluationResult {
  totalScore: number
  grade: string
  specialGrade?: string
  isMs: boolean
  isR: boolean
  desirableGrade: number
  desirableSubscores: number[]
  readingGrade: number
  readingSubscores: number[]
  competencyGrade: number
  competencySubscores: number[]
}

/**
 * Calculates standard Thai grade (0 - 4) based on 100-point total score
 */
export function calculateStandardGrade(totalScore: number): string {
  const rounded = Math.round(totalScore * 100) / 100
  if (rounded >= 80) return '4'
  if (rounded >= 75) return '3.5'
  if (rounded >= 70) return '3'
  if (rounded >= 65) return '2.5'
  if (rounded >= 60) return '2'
  if (rounded >= 55) return '1.5'
  if (rounded >= 50) return '1'
  return '0'
}

export interface AttendanceCalculationResult {
  period1Hours: number
  period2Hours: number
  totalAttendedHours: number
  maxTotalHours: number
  attendancePercentage: number
  isMs: boolean
}

/**
 * Calculates attendance hours and percentage across Period 1 (ก่อนกลางภาค) and Period 2 (หลังกลางภาค).
 * Automatically checks if attendance percentage < 80% to trigger "มส".
 */
export function calculateAttendancePercentage(
  period1Hours: number,
  period2Hours: number,
  maxPeriod1Hours: number,
  maxPeriod2Hours: number
): AttendanceCalculationResult {
  const p1 = Math.max(0, Number(period1Hours) || 0)
  const p2 = Math.max(0, Number(period2Hours) || 0)
  const maxP1 = Math.max(0, Number(maxPeriod1Hours) || 0)
  const maxP2 = Math.max(0, Number(maxPeriod2Hours) || 0)
  const maxTotal = maxP1 + maxP2

  if (maxTotal <= 0) {
    return {
      period1Hours: p1,
      period2Hours: p2,
      totalAttendedHours: 0,
      maxTotalHours: 0,
      attendancePercentage: 100,
      isMs: false
    }
  }

  const totalAttended = Math.min(maxTotal, p1 + p2)
  const percentage = Math.round((totalAttended / maxTotal) * 1000) / 10

  return {
    period1Hours: p1,
    period2Hours: p2,
    totalAttendedHours: totalAttended,
    maxTotalHours: maxTotal,
    attendancePercentage: percentage,
    isMs: percentage < 80.0
  }
}

/**
 * Checks attendance percentage and applies Thai academic rule:
 * Attendance < 80% automatically gets "มส" (No right to sit for final assessment)
 */
export function checkAttendanceStatus(
  attendancePercentage: number,
  existingSpecialGrade?: string
): { isMs: boolean; specialGrade?: string } {
  if (attendancePercentage < 80.0) {
    return {
      isMs: true,
      specialGrade: 'มส'
    }
  }

  // If previous specialGrade was มส but attendance is now >= 80%, clear it
  if (existingSpecialGrade === 'มส') {
    return {
      isMs: false,
      specialGrade: undefined
    }
  }

  return {
    isMs: false,
    specialGrade: existingSpecialGrade || undefined
  }
}

/**
 * Maps student grade to quality rating (0-3) using admin criteria
 */
export function mapGradeToAspectLevel(
  grade: string,
  specialGrade?: string,
  aspectCriteria?: AssessmentAspectCriteria,
  specialRules?: SpecialGradeCriteria
): number {
  if (specialGrade === 'มส') {
    return specialRules?.msLevel ?? 1
  }
  if (specialGrade === 'ร') {
    return specialRules?.rLevel ?? 1
  }

  const crit = aspectCriteria ?? {
    name: '',
    itemCount: 8,
    excellentMinGrade: 2.0,
    goodMinGrade: 1.0,
    passMinGrade: 0.0,
    defaultLevel: 3
  }

  const gradeNum = parseFloat(grade) || 0

  if (gradeNum >= crit.excellentMinGrade) return 3
  if (gradeNum >= crit.goodMinGrade) return 2
  if (gradeNum >= crit.passMinGrade) return 1
  return 0
}

/**
 * Returns Thai label for Desirable assessment (คุณลักษณะอันพึงประสงค์)
 * 3: ดีเยี่ยม, 2: ดี, 1: ผ่าน, 0: ไม่ผ่าน
 */
export function getDesirableLabel(level: number): string {
  switch (level) {
    case 3:
      return 'ดีเยี่ยม'
    case 2:
      return 'ดี'
    case 1:
      return 'ผ่าน'
    default:
      return 'ไม่ผ่าน'
  }
}

/**
 * Returns Thai label for Reading assessment (การอ่าน คิดวิเคราะห์ และเขียน)
 * 3: ดีเยี่ยม, 2: ดี, 1: ผ่าน, 0: ไม่ผ่าน
 */
export function getReadingLabel(level: number): string {
  switch (level) {
    case 3:
      return 'ดีเยี่ยม'
    case 2:
      return 'ดี'
    case 1:
      return 'ผ่าน'
    default:
      return 'ไม่ผ่าน'
  }
}

/**
 * Returns Thai label for individual Competency items (แต่ละสมรรถนะ 5 ด้าน)
 * 3: ดีมาก, 2: ดี, 1: ปรับปรุง
 */
export function getCompetencyItemLabel(level: number): string {
  switch (level) {
    case 3:
      return 'ดีมาก'
    case 2:
      return 'ดี'
    default:
      return 'ปรับปรุง'
  }
}

/**
 * Returns Thai label for overall Competency summary (สมรรถนะในภาพรวม)
 * 3: ดีเยี่ยม, 2: ดี, 1: พอใช้, 0: ปรับปรุง
 */
export function getCompetencySummaryLabel(level: number): string {
  switch (level) {
    case 3:
      return 'ดีเยี่ยม'
    case 2:
      return 'ดี'
    case 1:
      return 'พอใช้'
    default:
      return 'ปรับปรุง'
  }
}

/**
 * Generates an array of subscores with the specified level
 */
export function generateSubscores(count: number, level: number): number[] {
  return Array.from({ length: count }, () => level)
}

/**
 * Generates desirable subscores for the 8 items:
 * Items 1, 2, and 8 (indices 0, 1, 7) remain 3 (ดีเยี่ยม) for all academic grades.
 * Items 3, 4, 5, 6, 7 (indices 2, 3, 4, 5, 6) use the given level.
 */
export function generateDesirableSubscores(level: number): number[] {
  return Array.from({ length: 8 }, (_, idx) => {
    if (idx === 0 || idx === 1 || idx === 7) {
      return 3
    }
    return level
  })
}

/**
 * Calculates overall aspect grade from an array of subscores
 */
export function calculateSummaryGradeFromSubscores(subscores: number[]): number {
  if (!subscores || subscores.length === 0) return 0
  const sum = subscores.reduce((acc, curr) => acc + curr, 0)
  const avg = sum / subscores.length
  if (avg >= 2.5) return 3
  if (avg >= 1.5) return 2
  if (avg >= 1.0) return 1
  return 0
}

/**
 * Auto-maps student grade to 3-scale evaluation (0:ไม่ผ่าน, 1:ผ่าน, 2:ดี, 3:ดีเยี่ยม)
 */
export function calculateAuto3DAssessment(
  grade: string,
  specialGrade?: string,
  criteriaConfig?: AssessmentCriteriaConfig
): {
  desirableGrade: number
  desirableSubscores: number[]
  readingGrade: number
  readingSubscores: number[]
  competencyGrade: number
  competencySubscores: number[]
} {
  const config = criteriaConfig ?? DEFAULT_ASSESSMENT_CRITERIA

  const dLevel = mapGradeToAspectLevel(grade, specialGrade, config.desirable, config.specialGradeRules)
  const rLevel = mapGradeToAspectLevel(grade, specialGrade, config.reading, config.specialGradeRules)
  const cLevel = mapGradeToAspectLevel(grade, specialGrade, config.competency, config.specialGradeRules)

  return {
    desirableGrade: dLevel,
    desirableSubscores: generateDesirableSubscores(dLevel),
    readingGrade: rLevel,
    readingSubscores: generateSubscores(5, rLevel),
    competencyGrade: cLevel,
    competencySubscores: generateSubscores(5, cLevel)
  }
}

/**
 * Calculates weighted total score across all score columns
 * Each column is normalized: (score / maxScore) * weight
 */
export function calculateWeightedTotalScore(
  scores: Record<string, number>,
  absentMap: Record<string, boolean>,
  columns: ScoreColumnDefinition[]
): number {
  let total = 0

  for (const col of columns) {
    if (absentMap[col.id]) {
      continue
    }

    const rawScore = scores[col.id] || 0
    if (col.maxScore > 0) {
      const normalized = (rawScore / col.maxScore) * col.weight
      total += normalized
    } else {
      total += rawScore
    }
  }

  return Math.round(total * 100) / 100
}

/**
 * Consolidated calculation for student assessment
 */
export function evaluateStudent(params: {
  scores: Record<string, number>
  absentMap: Record<string, boolean>
  columns: ScoreColumnDefinition[]
  attendancePercentage: number
  specialGrade?: string
  isOverridden?: boolean
  overrideDesirable?: number
  overrideDesirableSubscores?: number[]
  overrideReading?: number
  overrideReadingSubscores?: number[]
  overrideCompetency?: number
  overrideCompetencySubscores?: number[]
  criteriaConfig?: AssessmentCriteriaConfig
}): EvaluationResult {
  const {
    scores,
    absentMap,
    columns,
    attendancePercentage,
    specialGrade,
    isOverridden,
    overrideDesirable,
    overrideDesirableSubscores,
    overrideReading,
    overrideReadingSubscores,
    overrideCompetency,
    overrideCompetencySubscores,
    criteriaConfig
  } = params

  const totalScore = calculateWeightedTotalScore(scores, absentMap, columns)
  let standardGrade = calculateStandardGrade(totalScore)

  const attendanceCheck = checkAttendanceStatus(attendancePercentage, specialGrade)
  const isMs = attendanceCheck.isMs
  const effectiveSpecialGrade = attendanceCheck.specialGrade
  const isR = effectiveSpecialGrade === 'ร'

  if (isMs || isR) {
    standardGrade = '0'
  }

  let desirableGrade = 3
  let desirableSubscores = generateDesirableSubscores(3)
  let readingGrade = 3
  let readingSubscores = generateSubscores(5, 3)
  let competencyGrade = 3
  let competencySubscores = generateSubscores(5, 3)

  if (isOverridden) {
    desirableGrade = overrideDesirable ?? 3
    desirableSubscores = overrideDesirableSubscores ?? generateDesirableSubscores(desirableGrade)
    readingGrade = overrideReading ?? 3
    readingSubscores = overrideReadingSubscores ?? generateSubscores(5, readingGrade)
    competencyGrade = overrideCompetency ?? 3
    competencySubscores = overrideCompetencySubscores ?? generateSubscores(5, competencyGrade)
  } else {
    const auto3D = calculateAuto3DAssessment(standardGrade, effectiveSpecialGrade, criteriaConfig)
    desirableGrade = auto3D.desirableGrade
    desirableSubscores = auto3D.desirableSubscores
    readingGrade = auto3D.readingGrade
    readingSubscores = auto3D.readingSubscores
    competencyGrade = auto3D.competencyGrade
    competencySubscores = auto3D.competencySubscores
  }

  return {
    totalScore,
    grade: standardGrade,
    specialGrade: effectiveSpecialGrade,
    isMs,
    isR,
    desirableGrade,
    desirableSubscores,
    readingGrade,
    readingSubscores,
    competencyGrade,
    competencySubscores
  }
}

/**
 * Checks if a score falls below the 60% threshold for formative and midterm assessments.
 * Applicable to periodType 1 (ก่อนกลางภาค), 2 (กลางภาค), and 3 (หลังกลางภาค).
 * Returns true if score < 60% of maxScore.
 */
export function isScoreBelowThreshold(
  score: number | undefined,
  maxScore: number,
  periodType: number,
  isAbsent?: boolean
): boolean {
  if (isAbsent || score === undefined || isNaN(score)) {
    return false
  }
  // Applies to period 1 (ก่อนกลางภาค), 2 (กลางภาค), 3 (หลังกลางภาค)
  if (periodType < 1 || periodType > 3) {
    return false
  }
  return score < maxScore * 0.6
}

export type AutoSGSExportMode = 'SCORES_MIDTERM' | 'SCORES_FINAL' | 'SCORES_ALL' | 'DESIRABLE' | 'READING'

export interface ExportStudentData {
  scores: Record<string, number>
  absentMap: Record<string, boolean>
  parsedDesirableSubscores?: number[]
  parsedReadingSubscores?: number[]
}

/**
 * Formats score and assessment data into tab-delimited strings (\t and \n)
 * strictly formatted for AutoSGS v1.1.3+ (D:\TUNorth\apps\sgs).
 * Prepends '# Source: NewTEA | Rows: N' header to preserve exact classroom rows.
 */
export function formatAutoSGSText(
  mode: AutoSGSExportMode,
  students: ExportStudentData[],
  scoreColumns: ScoreColumnDefinition[]
): string {
  if (students.length === 0) return ''

  const header = `# Source: NewTEA | Rows: ${students.length}`

  if (mode === 'SCORES_MIDTERM') {
    const targetCols = scoreColumns.filter((col) => col.periodType === 1 || col.periodType === 2)
    const rows = students.map((s) =>
      targetCols
        .map((col) => {
          if (s.absentMap[col.id]) return 'ข'
          const score = s.scores[col.id]
          return score !== undefined ? String(score) : ''
        })
        .join('\t')
    )
    return [header, ...rows].join('\n')
  }

  if (mode === 'SCORES_FINAL') {
    const targetCols = scoreColumns.filter((col) => col.periodType === 3 || col.periodType === 4)
    const rows = students.map((s) =>
      targetCols
        .map((col) => {
          if (s.absentMap[col.id]) return 'ข'
          const score = s.scores[col.id]
          return score !== undefined ? String(score) : ''
        })
        .join('\t')
    )
    return [header, ...rows].join('\n')
  }

  if (mode === 'SCORES_ALL') {
    const rows = students.map((s) =>
      scoreColumns
        .map((col) => {
          if (s.absentMap[col.id]) return 'ข'
          const score = s.scores[col.id]
          return score !== undefined ? String(score) : ''
        })
        .join('\t')
    )
    return [header, ...rows].join('\n')
  }

  if (mode === 'DESIRABLE') {
    const rows = students.map((s) => {
      const items = s.parsedDesirableSubscores || [3, 3, 3, 3, 3, 3, 3, 3]
      return items.slice(0, 8).join('\t') + '\t\t\t\t'
    })
    return [header, ...rows].join('\n')
  }

  if (mode === 'READING') {
    const rows = students.map((s) => {
      const items = s.parsedReadingSubscores || [3, 3, 3, 3, 3]
      return items.slice(0, 5).join('\t') + '\t\t\t'
    })
    return [header, ...rows].join('\n')
  }

  return ''
}



