export function createStudioId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `studio-${Math.random().toString(36).slice(2, 10)}`;
}
