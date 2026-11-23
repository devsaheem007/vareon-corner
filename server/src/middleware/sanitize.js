/**
 * Defence in depth against NoSQL operator injection: drops any key that starts with `$`
 * or contains `.` from body / query / params (zod schemas then enforce exact shapes).
 */
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key.startsWith("$") || key.includes(".")) delete value[key];
      else value[key] = clean(value[key]);
    }
  }
  return value;
}

export default function sanitize(req, _res, next) {
  clean(req.body);
  clean(req.query);
  clean(req.params);
  next();
}
