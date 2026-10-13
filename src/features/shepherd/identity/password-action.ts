export type PasswordAction = "invite" | "recovery";
const storageKey = "shepherd-password-action";
export function passwordLinkIntent(href: string): {
  hasCallback: boolean;
  hasError: boolean;
  action: PasswordAction | null;
} {
  const url = new URL(href);
  const params = new URLSearchParams(url.hash.slice(1));
  const type = params.get("type");
  const hasError = params.has("error") || params.has("error_code");
  const hasCallback = hasError || params.has("access_token") || params.has("refresh_token");
  return {
    hasCallback,
    hasError,
    action: hasCallback && (type === "invite" || type === "recovery") ? type : null,
  };
}
export function pendingPasswordAction(storage: Storage, userId: string): PasswordAction | null {
  try {
    const value = JSON.parse(storage.getItem(storageKey) ?? "null");
    return value?.userId === userId && (value.action === "invite" || value.action === "recovery")
      ? value.action
      : null;
  } catch {
    return null;
  }
}
export function savePasswordAction(storage: Storage, userId: string, action: PasswordAction) {
  try {
    storage.setItem(storageKey, JSON.stringify({ userId, action }));
  } catch {
    /* Password editing still works if sessionStorage is unavailable. */
  }
}
export function clearPasswordAction(storage: Storage) {
  try {
    storage.removeItem(storageKey);
  } catch {
    /* The auth session remains the authority. */
  }
}
export function passwordProblem(password: string, confirmation: string) {
  if (password.length < 12) return "Use at least 12 characters for your password.";
  if (password.length > 128) return "Use no more than 128 characters for your password.";
  if (password !== confirmation) return "The passwords do not match.";
  return null;
}
