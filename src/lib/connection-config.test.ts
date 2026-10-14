import { describe, expect, it } from "vitest";
import { readConnection } from "./connection-config";
const publicEnv = {
  VITE_APP_MODE: "connected",
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_public_key",
};
describe("connected configuration", () => {
  it("requires explicit demo mode and otherwise fails closed", () => {
    expect(readConnection({}).mode).toBe("invalid");
    expect(readConnection({ VITE_APP_MODE: "demo" }).mode).toBe("demo");
    expect(readConnection({ VITE_APP_MODE: "connected" }).mode).toBe("invalid");
    expect(readConnection({ VITE_APP_MODE: "production" }).mode).toBe("invalid");
  });
  it("accepts a public key and HTTPS project, or local development URL", () => {
    expect(readConnection(publicEnv).mode).toBe("connected");
    expect(readConnection({ ...publicEnv, VITE_SUPABASE_URL: "ftp://localhost" }).mode).toBe(
      "invalid",
    );
    expect(readConnection({ ...publicEnv, VITE_SUPABASE_URL: "http://127.0.0.1:54321" }).mode).toBe(
      "connected",
    );
  });
  it.each([
    "sb_secret_private_key",
    `header.${btoa(JSON.stringify({ role: "service_role" }))}.sig`,
    "broken",
  ])("rejects private and invalid keys (%s)", (key) => {
    expect(readConnection({ ...publicEnv, VITE_SUPABASE_PUBLISHABLE_KEY: key }).mode).toBe(
      "invalid",
    );
  });
  it.each([
    "http://example.supabase.co",
    "https://user:pass@example.supabase.co",
    "https://example.supabase.co/auth/v1",
    "https://example.supabase.co?key=bad",
  ])("rejects unsafe or malformed project URLs", (url) => {
    expect(readConnection({ ...publicEnv, VITE_SUPABASE_URL: url }).mode).toBe("invalid");
  });
  it("supports a legacy anonymous key", () => {
    expect(
      readConnection({
        ...publicEnv,
        VITE_SUPABASE_PUBLISHABLE_KEY: `header.${btoa(JSON.stringify({ role: "anon" }))}.sig`,
      }).mode,
    ).toBe("connected");
  });
});
