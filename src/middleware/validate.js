import { validationResult } from "express-validator";

export function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    message: "Validation failed",
    errors: errors.array().map((item) => ({
      field: item.path,
      message: item.msg,
    })),
  });
}
