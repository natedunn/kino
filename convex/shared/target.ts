export const targetGranularities = ["day", "month", "quarter", "year"] as const

export type TargetGranularity = (typeof targetGranularities)[number]

export type TargetRange = {
  end: string
  start: string
}

export type TargetValue = {
  granularity: TargetGranularity
  target: string
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

const GRANULARITY_SORT_ORDER: Record<TargetGranularity, number> = {
  day: 0,
  month: 1,
  quarter: 2,
  year: 3,
}

export function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function daysInMonth(year: number, month: number) {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  if ([4, 6, 9, 11].includes(month)) return 30
  return 31
}

function parseYear(value: string) {
  if (!/^\d{4}$/.test(value)) return null
  const year = Number(value)
  return year >= 1000 && year <= 9999 ? year : null
}

function parseMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = parseYear(match[1])
  const month = Number(match[2])
  if (year === null || month < 1 || month > 12) return null
  return { month, year }
}

function parseDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = parseYear(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year === null || month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(year, month)) return null
  return { day, month, year }
}

function parseQuarter(value: string) {
  const match = /^(\d{4})-Q([1-4])$/.exec(value)
  if (!match) return null
  const year = parseYear(match[1])
  const quarter = Number(match[2])
  if (year === null) return null
  return { quarter, year }
}

export function isValidTarget(
  target: string,
  granularity: TargetGranularity
) {
  switch (granularity) {
    case "day":
      return parseDay(target) !== null
    case "month":
      return parseMonth(target) !== null
    case "quarter":
      return parseQuarter(target) !== null
    case "year":
      return parseYear(target) !== null
  }
}

export function resolveTarget(
  target: string,
  granularity: TargetGranularity
): TargetRange {
  switch (granularity) {
    case "day": {
      if (!parseDay(target)) throw new Error("Invalid day target")
      return { end: target, start: target }
    }
    case "month": {
      const parsed = parseMonth(target)
      if (!parsed) throw new Error("Invalid month target")
      return {
        end: `${parsed.year}-${pad2(parsed.month)}-${pad2(
          daysInMonth(parsed.year, parsed.month)
        )}`,
        start: `${parsed.year}-${pad2(parsed.month)}-01`,
      }
    }
    case "quarter": {
      const parsed = parseQuarter(target)
      if (!parsed) throw new Error("Invalid quarter target")
      const startMonth = (parsed.quarter - 1) * 3 + 1
      const endMonth = startMonth + 2
      return {
        end: `${parsed.year}-${pad2(endMonth)}-${pad2(
          daysInMonth(parsed.year, endMonth)
        )}`,
        start: `${parsed.year}-${pad2(startMonth)}-01`,
      }
    }
    case "year": {
      const year = parseYear(target)
      if (year === null) throw new Error("Invalid year target")
      return { end: `${year}-12-31`, start: `${year}-01-01` }
    }
  }
}

export function resolveTargetOrNull(
  target: string | null | undefined,
  granularity: TargetGranularity | null | undefined
) {
  if (!target || !granularity) return null
  if (!isValidTarget(target, granularity)) return null
  return resolveTarget(target, granularity)
}

export function formatTarget(
  target: string,
  granularity: TargetGranularity
) {
  switch (granularity) {
    case "day": {
      const parsed = parseDay(target)
      if (!parsed) throw new Error("Invalid day target")
      return `${MONTH_NAMES_SHORT[parsed.month - 1]} ${parsed.day}, ${parsed.year}`
    }
    case "month": {
      const parsed = parseMonth(target)
      if (!parsed) throw new Error("Invalid month target")
      return `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}`
    }
    case "quarter": {
      const parsed = parseQuarter(target)
      if (!parsed) throw new Error("Invalid quarter target")
      return `Q${parsed.quarter} ${parsed.year}`
    }
    case "year": {
      const year = parseYear(target)
      if (year === null) throw new Error("Invalid year target")
      return String(year)
    }
  }
}

export function formatTargetOrUnscheduled(
  target: string | null | undefined,
  granularity: TargetGranularity | null | undefined
) {
  if (!target || !granularity || !isValidTarget(target, granularity)) {
    return "Unscheduled"
  }
  return formatTarget(target, granularity)
}

// UI-facing date helpers (pure; safe to call from the frontend). These build on
// the parsers above so the client and server share a single source of truth.
export function dayTargetFromDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`
}

export function dateFromDayTarget(target: string | null | undefined) {
  const parsed = parseDay(target ?? "")
  if (!parsed) return undefined
  return new Date(parsed.year, parsed.month - 1, parsed.day)
}

export function getQuarterFromDate(date: Date) {
  return Math.floor(date.getMonth() / 3) + 1
}

export function parseMonthParts(target: string) {
  return parseMonth(target)
}

export function parseQuarterParts(target: string) {
  return parseQuarter(target)
}

export function compareTargets(
  left: TargetValue | null | undefined,
  right: TargetValue | null | undefined
) {
  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1

  const leftRange = resolveTarget(left.target, left.granularity)
  const rightRange = resolveTarget(right.target, right.granularity)
  if (leftRange.start !== rightRange.start) {
    return leftRange.start < rightRange.start ? -1 : 1
  }

  return (
    GRANULARITY_SORT_ORDER[left.granularity] -
    GRANULARITY_SORT_ORDER[right.granularity]
  )
}
