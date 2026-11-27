// Keep authorization ahead of any future private program data read.
export async function loadPrivateProgram({ enabled, authenticate, load }) {
  if (enabled !== true) return { allowed: false, data: null };
  if (typeof authenticate !== "function" || !(await authenticate())) {
    return { allowed: false, data: null };
  }
  if (typeof load !== "function") throw new TypeError("private program loader required");
  return { allowed: true, data: await load() };
}
