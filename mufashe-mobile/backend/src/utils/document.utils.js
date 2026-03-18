function normalizeCategory(category) {
  return category ? String(category).trim().toUpperCase() : undefined;
}

module.exports = { normalizeCategory };