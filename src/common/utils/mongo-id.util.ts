const mongoIdPattern = /^[0-9a-fA-F]{24}$/;

export function isMongoId(value: unknown): value is string {
  return typeof value === 'string' && mongoIdPattern.test(value);
}
