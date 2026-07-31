const portableRegexFlagsPattern = /^[gims]+$/;

export function isPortableRegex(pattern: string, flags = "") {
  if (flags && (!portableRegexFlagsPattern.test(flags) || new Set(flags).size !== flags.length)) {
    return false;
  }

  try {
    new RegExp(pattern, flags);
  } catch {
    return false;
  }

  if (/\(\?/.test(pattern)) return false;
  if (/\\(?:[1-9]|k<|k'|g<|g')/.test(pattern)) return false;
  if (/(?:[?*+]|\{\d+(?:,\d*)?\})\+/.test(pattern)) return false;

  return true;
}

const portableDatePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;

export function getPortableDate(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;

  const match = portableDatePattern.exec(value);
  if (!match) return null;

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    ,
    zone,
    ,
    offsetHourText,
    offsetMinuteText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = Number(offsetHourText || 0);
  const offsetMinute = Number(offsetMinuteText || 0);
  const daysInMonth =
    month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;

  if (
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (zone !== "Z" && (offsetHour > 23 || offsetMinute > 59))
  ) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function valuesAreEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => valuesAreEqual(value, right[index]))
    );
  }
  if (
    left &&
    right &&
    typeof left === "object" &&
    typeof right === "object" &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(rightRecord, key) &&
          valuesAreEqual(leftRecord[key], rightRecord[key]),
      )
    );
  }
  return false;
}

const unsafePathSegments = new Set(["__proto__", "prototype", "constructor"]);

export function getSafePathSegments(path: string): string[] | null {
  if (!path || typeof path !== "string") return null;
  const segments = path.split(".");
  return segments.some((segment) => !segment || unsafePathSegments.has(segment)) ? null : segments;
}

export function hasOwn(value: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function isTransportSafeValue(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "undefined") return false;
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((entry) => isTransportSafeValue(entry, seen))
    : Object.keys(value).every((key) =>
        isTransportSafeValue((value as Record<string, unknown>)[key], seen),
      );
  seen.delete(value);
  return valid;
}
