export const computeAgeFromIsoDob = (isoDob: string, now = new Date()): number | null => {
  const trimmed = (isoDob ?? '').trim();
  if (!trimmed) return null;

  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(trimmed);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const birth = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(birth.getTime())) return null;

  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }

  if (age < 0 || age > 120) return null;
  return age;
};

export const resolveAge = (params: { age?: number | null; date_of_birth?: string | null }): number | null => {
  const computed = params.date_of_birth ? computeAgeFromIsoDob(params.date_of_birth) : null;
  if (computed !== null) return computed;
  if (typeof params.age === 'number' && Number.isFinite(params.age)) return params.age;
  return null;
};
