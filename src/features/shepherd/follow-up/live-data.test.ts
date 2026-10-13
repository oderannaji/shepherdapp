import { expect, it } from "vitest";
import { contactLinks } from "./live-data";
it("opens valid phone/WhatsApp links without suggesting a conversation was completed", () => {
  expect(contactLinks({ outcome: "Reached", phone_e164: "+447700900123" })).toEqual({
    call: "tel:+447700900123",
    whatsapp: "https://wa.me/447700900123",
  });
});
it.each(["Do not contact", "Wrong number"] as const)(
  "suppresses contact actions for %s",
  (outcome) => {
    expect(contactLinks({ outcome, phone_e164: "+447700900123" })).toBeNull();
  },
);
it.each([null, "07700900123", "javascript:alert(1)", "+44 7700 900123"])(
  "rejects missing or non-E164 contact numbers",
  (phone_e164) => {
    expect(contactLinks({ outcome: "Reached", phone_e164 })).toBeNull();
  },
);
