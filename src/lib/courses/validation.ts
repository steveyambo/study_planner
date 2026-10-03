export function parseCourse(fields: FormData) {
  const code = String(fields.get("code") ?? "").trim().toUpperCase();
  const name = String(fields.get("name") ?? "").trim();
  const color = String(fields.get("color") ?? "");
  const multiplierText = String(fields.get("revision_multiplier") ?? "").trim();
  const revision_multiplier = Number(multiplierText);
  if (!code || code.length > 40 || !name || name.length > 160 ||
      !/^#[0-9a-fA-F]{6}$/.test(color) || !multiplierText ||
      !Number.isFinite(revision_multiplier) || revision_multiplier < 0.01 ||
      revision_multiplier > 99.99 || Math.abs(revision_multiplier * 100 - Math.round(revision_multiplier * 100)) > 0.000001) {
    return null;
  }
  return { code, name, color, revision_multiplier };
}

export function isCourseId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
