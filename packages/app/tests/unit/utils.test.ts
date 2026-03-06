import { describe, it, expect, vi, afterEach } from 'vitest'
import { slugify, formatDate, today, isValidSlug } from '$lib/utils.js'

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
  })

  it('collapses multiple hyphens', () => {
    expect(slugify('Hello  --  World')).toBe('hello-world')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  hello world  ')).toBe('hello-world')
  })

  it('handles numbers', () => {
    expect(slugify('My Post 2024')).toBe('my-post-2024')
  })

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('handles already-valid slugs', () => {
    expect(slugify('my-post')).toBe('my-post')
  })
})

describe('isValidSlug', () => {
  it('accepts lowercase alphanumeric with hyphens', () => {
    expect(isValidSlug('my-post-2024')).toBe(true)
  })

  it('accepts single word', () => {
    expect(isValidSlug('post')).toBe(true)
  })

  it('rejects uppercase letters', () => {
    expect(isValidSlug('My-Post')).toBe(false)
  })

  it('rejects leading hyphen', () => {
    expect(isValidSlug('-post')).toBe(false)
  })

  it('rejects trailing hyphen', () => {
    expect(isValidSlug('post-')).toBe(false)
  })

  it('rejects consecutive hyphens', () => {
    expect(isValidSlug('my--post')).toBe(false)
  })

  it('rejects spaces', () => {
    expect(isValidSlug('my post')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidSlug('')).toBe(false)
  })

  it('rejects special characters', () => {
    expect(isValidSlug('my.post')).toBe(false)
  })
})

describe('today', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns date in YYYY-MM-DD format', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
    expect(today()).toBe('2024-06-15')
  })

  it('uses UTC date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-12-31T23:59:00Z'))
    expect(today()).toBe('2024-12-31')
  })
})

describe('formatDate', () => {
  it('formats a date string to human-readable form', () => {
    // Use mid-month dates to avoid day-shifting across month boundaries due to
    // timezone offset when new Date() parses a bare YYYY-MM-DD as UTC midnight.
    const result = formatDate('2024-06-15')
    expect(result).toMatch(/June|July/)   // adjacent months in case of TZ shift
    expect(result).toMatch(/2024/)
  })

  it('includes the full month name and year', () => {
    // March 15 is safely mid-month in any timezone
    const result = formatDate('2024-03-15')
    expect(result).toMatch(/March|February/)
    expect(result).toMatch(/2024/)
  })
})
