export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeIngredientName(value) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bplain\b/g, " ")
    .replace(/\bcooked\b/g, " ")
    .replace(/\bdry\b/g, " ")
    .replace(/\sfresh\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatIngredientName(value) {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bplain\b/gi, " ")
    .replace(/\bcooked\b/gi, " ")
    .replace(/\bdry\b/gi, " ")
    .replace(/\sfresh\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getIngredientKey(value) {
  return slugify(normalizeIngredientName(value));
}

export function round(value) {
  return Math.round(value * 10) / 10;
}

export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(startDate, offset) {
  const nextDate = new Date(`${startDate}T12:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + offset);
  return formatDate(nextDate);
}

export function subtractDays(startDate, offset) {
  return addDays(startDate, -offset);
}
