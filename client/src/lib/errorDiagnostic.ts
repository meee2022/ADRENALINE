/** Only extract allowlisted metadata. Never display a server stack or raw payload. */
export function errorDiagnostic(error?: Error) {
  const message = error?.message || "";
  const operation = message.match(/\[CONVEX [QMA]\(([a-zA-Z0-9_/:.-]+)\)\]/)?.[1];
  const requestId = message.match(/\[Request ID: ([a-fA-F0-9-]+)\]/)?.[1];
  return { operation, requestId };
}
