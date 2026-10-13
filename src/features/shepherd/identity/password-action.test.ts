import { beforeEach, expect, it } from "vitest";
import {
  passwordLinkIntent,
  passwordProblem,
  pendingPasswordAction,
  savePasswordAction,
  clearPasswordAction,
} from "./password-action";
beforeEach(() => sessionStorage.clear());
it("requires an auth callback rather than a user-controlled type hint alone", () => {
  expect(passwordLinkIntent("https://app.example/#type=recovery").action).toBeNull();
  expect(
    passwordLinkIntent("https://app.example/#access_token=synthetic&type=recovery").action,
  ).toBe("recovery");
  expect(passwordLinkIntent("https://app.example/#access_token=synthetic&type=invite").action).toBe(
    "invite",
  );
  expect(
    passwordLinkIntent("https://app.example/#access_token=synthetic&type=signup").action,
  ).toBeNull();
});
it("identifies expired links so an existing login is not used for a failed reset", () => {
  expect(
    passwordLinkIntent("https://app.example/#error=access_denied&error_code=otp_expired"),
  ).toMatchObject({ hasCallback: true, hasError: true, action: null });
});
it("retains only the password step across refresh, scoped to the same account", () => {
  savePasswordAction(sessionStorage, "one-user", "invite");
  expect(pendingPasswordAction(sessionStorage, "one-user")).toBe("invite");
  expect(pendingPasswordAction(sessionStorage, "different-user")).toBeNull();
  clearPasswordAction(sessionStorage);
  expect(pendingPasswordAction(sessionStorage, "one-user")).toBeNull();
});
it("requires a matching password of suitable length", () => {
  expect(passwordProblem("short", "short")).toContain("12");
  expect(passwordProblem("A long enough password", "a different password")).toContain("match");
  expect(passwordProblem("A long enough password", "A long enough password")).toBeNull();
  expect(passwordProblem("a".repeat(129), "a".repeat(129))).toContain("128");
});
