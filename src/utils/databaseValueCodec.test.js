import { describe, expect, it } from 'vitest'
import { formatCellValue, getInputComponentByType } from './database.js'

describe('database value formatting', () => {
  it('preserves exact integers and decimals as text', () => {
    expect(formatCellValue('9223372036854775807', { type: 'BIGINT' })).toBe(
      '9223372036854775807'
    )
    expect(formatCellValue('1234567890.123456789', { type: 'DECIMAL(30,9)' })).toBe(
      '1234567890.123456789'
    )
  })

  it('renders null distinctly from an empty string', () => {
    expect(formatCellValue(null, { type: 'VARCHAR' })).toBe('(NULL)')
    expect(formatCellValue('', { type: 'VARCHAR' })).toBe('')
  })

  it('uses text inputs for exact numeric columns', () => {
    expect(getInputComponentByType('BIGINT')).toBe('el-input')
    expect(getInputComponentByType('NUMERIC(30, 10)')).toBe('el-input')
  })
})
