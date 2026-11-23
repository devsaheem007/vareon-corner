/** validate(schema, "body" | "query" | "params") - replaces the source with the parsed (typed, stripped) value. */
export const validate =
  (schema, source = "body") =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    req[source] = result.data;
    next();
  };
