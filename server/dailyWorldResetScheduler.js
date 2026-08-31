const DEFAULT_TIME_ZONE = "America/Toronto";
const DEFAULT_RESET_HOUR = 5;
const DEFAULT_WARNING_MINUTES = Object.freeze([15, 5, 1]);

const createZonedDateTimeFormatter = (timeZone) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
};

const getZonedDateTimeParts = (timestamp, formatter) => {
  const values = {};
  for (const part of formatter.formatToParts(timestamp)) {
    if (part.type !== "literal") {
      values[part.type] = Number.parseInt(part.value, 10);
    }
  }
  return values;
};

const getTimestampForZonedDateTime = (dateTime, formatter) => {
  const desiredUtcTimestamp = Date.UTC(
    dateTime.year,
    dateTime.month - 1,
    dateTime.day,
    dateTime.hour,
    dateTime.minute,
    dateTime.second,
  );
  let timestamp = desiredUtcTimestamp;

  for (let iteration = 0; iteration < 4; iteration++) {
    const rendered = getZonedDateTimeParts(timestamp, formatter);
    const renderedUtcTimestamp = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second,
    );
    const correction = desiredUtcTimestamp - renderedUtcTimestamp;
    timestamp += correction;
    if (correction === 0) {
      break;
    }
  }

  return timestamp;
};

export const getNextDailyWorldResetAt = (
  currentTimestamp,
  { timeZone = DEFAULT_TIME_ZONE, resetHour = DEFAULT_RESET_HOUR } = {},
) => {
  if (!Number.isFinite(currentTimestamp) || !Number.isInteger(resetHour) || resetHour < 0 || resetHour > 23) {
    return null;
  }

  const formatter = createZonedDateTimeFormatter(timeZone);
  const current = getZonedDateTimeParts(currentTimestamp, formatter);
  const resetAlreadyPassed =
    current.hour > resetHour ||
    (current.hour === resetHour && (current.minute > 0 || current.second > 0));
  const targetDate = new Date(Date.UTC(current.year, current.month - 1, current.day + Number(resetAlreadyPassed)));

  return getTimestampForZonedDateTime(
    {
      year: targetDate.getUTCFullYear(),
      month: targetDate.getUTCMonth() + 1,
      day: targetDate.getUTCDate(),
      hour: resetHour,
      minute: 0,
      second: 0,
    },
    formatter,
  );
};

export const createDailyWorldResetScheduler = ({
  timeZone = DEFAULT_TIME_ZONE,
  resetHour = DEFAULT_RESET_HOUR,
  warningMinutes = DEFAULT_WARNING_MINUTES,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  onWarning = () => {},
  onReset,
} = {}) => {
  if (typeof now !== "function" || typeof setTimer !== "function" || typeof clearTimer !== "function" || typeof onReset !== "function") {
    throw new TypeError("The daily world reset scheduler requires timer functions and an onReset callback.");
  }

  const currentTimestamp = now();
  const nextResetAt = getNextDailyWorldResetAt(currentTimestamp, { timeZone, resetHour });
  if (!Number.isFinite(nextResetAt)) {
    throw new RangeError("The next daily world reset could not be calculated.");
  }

  const timers = [];
  const safeWarningMinutes = [...new Set(warningMinutes)]
    .filter((minutes) => Number.isInteger(minutes) && minutes > 0)
    .sort((first, second) => second - first);

  for (const minutes of safeWarningMinutes) {
    const warningAt = nextResetAt - minutes * 60 * 1000;
    if (warningAt <= currentTimestamp) {
      continue;
    }
    timers.push(setTimer(() => onWarning(minutes), warningAt - currentTimestamp));
  }
  timers.push(setTimer(onReset, Math.max(0, nextResetAt - currentTimestamp)));

  return Object.freeze({
    nextResetAt,
    stop() {
      for (const timer of timers) {
        clearTimer(timer);
      }
      timers.length = 0;
    },
  });
};
