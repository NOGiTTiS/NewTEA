import { describe, expect, it } from 'bun:test'
import { compareRooms, sortRooms } from './utils'

describe('Natural Sorting of Classrooms', () => {
  it('correctly sorts 6.1 through 6.15 naturally', () => {
    const raw = ['6.1', '6.10', '6.11', '6.15', '6.2', '6.9', '6.3']
    const sorted = sortRooms(raw)
    expect(sorted).toEqual(['6.1', '6.2', '6.3', '6.9', '6.10', '6.11', '6.15'])
  })

  it('correctly sorts across different grades (4, 5, 6)', () => {
    const raw = ['6.1', '4.15', '5.10', '4.2', '6.10', '5.2', '4.1']
    const sorted = sortRooms(raw)
    expect(sorted).toEqual(['4.1', '4.2', '4.15', '5.2', '5.10', '6.1', '6.10'])
  })

  it('compareRooms handles equal rooms', () => {
    expect(compareRooms('6.1', '6.1')).toBe(0)
  })

  it('compareRooms identifies 6.2 as smaller than 6.10', () => {
    expect(compareRooms('6.2', '6.10')).toBeLessThan(0)
    expect(compareRooms('6.10', '6.2')).toBeGreaterThan(0)
  })
})
