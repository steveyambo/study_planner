export function parseCourse(fields: FormData) {
  const code = String(fields.get("code") ?? "").trim().toUpperCase();
  const name = String(fields.get("name") ?? "").trim();
  const color = String(fields.get("color") ?? "");
  const multiplierText = String(fields.get("revision_multiplier") ?? "").trim();
  const revision_multiplier = Number(multiplierText);
  const starts_on = String(fields.get("starts_on") ?? "").trim() || null;
  const ends_on = String(fields.get("ends_on") ?? "").trim() || null;
  const validDate = (value: string | null) => value === null || (/^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "0001-01-01" &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
  if (!validDate(starts_on) || !validDate(ends_on) || (starts_on && ends_on && starts_on > ends_on)) return null;
  if (!code || code.length > 40 || !name || name.length > 160 ||
      !/^#[0-9a-fA-F]{6}$/.test(color) || !multiplierText ||
      !Number.isFinite(revision_multiplier) || revision_multiplier < 0.01 ||
      revision_multiplier > 99.99 || Math.abs(revision_multiplier * 100 - Math.round(revision_multiplier * 100)) > 0.000001) {
    return null;
  }
  return { code, name, color, revision_multiplier, starts_on, ends_on };
}

export function isCourseId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
