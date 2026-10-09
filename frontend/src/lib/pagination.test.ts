import { describe, expect, it } from 'bun:test'
import { getPaginationRange, paginateArray } from './pagination'

describe('Pagination Unit Tests', () => {
  describe('getPaginationRange', () => {
    it('returns [1] when totalPages is 0 or 1', () => {
      expect(getPaginationRange(1, 0)).toEqual([1])
      expect(getPaginationRange(1, 1)).toEqual([1])
    })

    it('returns all page numbers when totalPages is small', () => {
      expect(getPaginationRange(1, 5)).toEqual([1, 2, 3, 4, 5])
      expect(getPaginationRange(3, 6)).toEqual([1, 2, 3, 4, 5, 6])
      expect(getPaginationRange(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('returns right dots when on early pages with many total pages', () => {
      const range = getPaginationRange(1, 10, 1)
      expect(range).toEqual([1, 2, 3, 4, 5, '...', 10])
    })

    it('returns left dots when on late pages with many total pages', () => {
      const range = getPaginationRange(10, 10, 1)
      expect(range).toEqual([1, '...', 6, 7, 8, 9, 10])
    })

    it('returns both left and right dots when in the middle', () => {
      const range = getPaginationRange(6, 12, 1)
      expect(range).toEqual([1, '...', 5, 6, 7, '...', 12])
    })
  })

  describe('paginateArray', () => {
    const sampleItems = Array.from({ length: 35 }, (_, i) => i + 1)

    it('returns empty array when items is empty', () => {
      expect(paginateArray([], 1, 10)).toEqual([])
    })

    it('returns correct slice for page 1', () => {
      const p1 = paginateArray(sampleItems, 1, 10)
      expect(p1.length).toBe(10)
      expect(p1[0]).toBe(1)
      expect(p1[9]).toBe(10)
    })

    it('returns correct slice for page 2', () => {
      const p2 = paginateArray(sampleItems, 2, 10)
      expect(p2.length).toBe(10)
      expect(p2[0]).toBe(11)
      expect(p2[9]).toBe(20)
    })

    it('returns remaining items on the last page', () => {
      const p4 = paginateArray(sampleItems, 4, 10)
      expect(p4.length).toBe(5)
      expect(p4[0]).toBe(31)
      expect(p4[4]).toBe(35)
    })

    it('returns empty array when page is beyond total items', () => {
      const p5 = paginateArray(sampleItems, 5, 10)
      expect(p5).toEqual([])
    })

    it('safely handles 0 or negative page / pageSize', () => {
      const p0 = paginateArray(sampleItems, 0, 10)
      expect(p0.length).toBe(10)
      expect(p0[0]).toBe(1)
    })
  })
})
