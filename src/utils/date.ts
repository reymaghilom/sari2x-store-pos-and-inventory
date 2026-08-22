export function startOfLocalToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function localDateFromStorage(value?: string) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) return date;
    return null;
  }
  const legacy = new Date(value);
  return Number.isNaN(legacy.getTime()) ? null : new Date(legacy.getFullYear(), legacy.getMonth(), legacy.getDate(), 12);
}

export function localDateToStorage(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidNewDueDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? localDateFromStorage(value) : null;
  return Boolean(date && date >= startOfLocalToday());
}

export function formatStoredDate(value?: string) {
  const date = localDateFromStorage(value);
  return date ? date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : value ?? '';
}
