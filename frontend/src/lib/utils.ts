import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * เปรียบเทียบรหัสห้องเรียน เช่น "6.2" กับ "6.10" เพื่อจัดเรียงแบบ Natural Sort
 */
export function compareRooms(a: string, b: string): number {
  const [gradeA, roomA] = a.split('.').map(Number)
  const [gradeB, roomB] = b.split('.').map(Number)
  if ((gradeA || 0) !== (gradeB || 0)) {
    return (gradeA || 0) - (gradeB || 0)
  }
  return (roomA || 0) - (roomB || 0)
}

/**
 * จัดเรียงรายการห้องเรียนตามลำดับตัวเลข 4.1 -> 4.2 ... 4.15, 6.1 -> 6.15
 */
export function sortRooms(rooms: string[]): string[] {
  return [...rooms].sort(compareRooms)
}
