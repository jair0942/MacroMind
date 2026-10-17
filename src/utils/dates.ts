export const localDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDate = (date = new Date()): string =>
  new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);

export const formatTime = (iso: string): string =>
  new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export const formatShortDate = (value: string): string =>
  new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`));

export const dateFromKey = (value: string): Date => new Date(`${value}T12:00:00`);

export const addDays = (value: string | Date, amount: number): Date => {
  const date = typeof value === 'string' ? dateFromKey(value) : new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
};

export const dateRange = (start: string, end: string): string[] => {
  const dates: string[] = [];
  for (let current = dateFromKey(start); current <= dateFromKey(end); current = addDays(current, 1)) dates.push(localDateKey(current));
  return dates;
};

export const startOfWeek = (date = new Date()): Date => {
  const value = new Date(date);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value;
};

export const periodRange = (period: 'day' | 'week' | 'month', reference = new Date()): { start: string; end: string } => {
  const date = new Date(reference);
  if (period === 'day') return { start: localDateKey(date), end: localDateKey(date) };
  if (period === 'week') {
    const start = startOfWeek(date);
    return { start: localDateKey(start), end: localDateKey(addDays(start, 6)) };
  }
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
  return { start: localDateKey(start), end: localDateKey(end) };
};
