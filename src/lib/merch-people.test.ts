import { describe, expect, it } from 'vitest'
import { crewPickerPeople } from './merch-people'

describe('crewPickerPeople', () => {
  it('lists Merch crew first, then everyone else, each by name', () => {
    const people = [{ id: '1', name: 'Zoe' }, { id: '2', name: 'Arjun' }, { id: '3', name: 'Meera' }, { id: '4', name: 'Dev' }]
    expect(crewPickerPeople(people, ['3', '4']).map(p => [p.name, p.crew])).toEqual([
      ['Dev', true], ['Meera', true], ['Arjun', false], ['Zoe', false],
    ])
  })
})
