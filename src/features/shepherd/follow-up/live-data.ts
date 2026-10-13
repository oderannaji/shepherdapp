import { z } from "zod";
export const livePersonSchema = z.object({
  id: z.string().uuid(),
  organisation_id: z.string().uuid(),
  full_name: z.string(),
  phone_e164: z.string().nullable(),
  owner_user_id: z.string().uuid(),
  outcome: z.enum([
    "Reached",
    "No answer",
    "Callback",
    "Will return",
    "Wrong number",
    "Do not contact",
  ]),
  callback_on: z.string().nullable(),
  revision: z.number().int(),
});
export type LivePerson = z.infer<typeof livePersonSchema>;
export const attemptSchema = z.object({
  id: z.string().uuid(),
  actor_name: z.string(),
  outcome: z.string(),
  callback_on: z.string().nullable(),
  note: z.string(),
  created_at: z.string(),
});
export function contactLinks(person: Pick<LivePerson, "phone_e164" | "outcome">) {
  if (
    ["Do not contact", "Wrong number"].includes(person.outcome) ||
    !person.phone_e164 ||
    !/^\+[1-9][0-9]{7,14}$/.test(person.phone_e164)
  )
    return null;
  return {
    call: `tel:${person.phone_e164}`,
    whatsapp: `https://wa.me/${person.phone_e164.slice(1)}`,
  };
}
export function saveError(code?: string) {
  if (code === "40001")
    return "Someone updated this contact. Copy your draft, then reload the contact before saving.";
  if (code === "42501")
    return "You no longer have permission to save this contact. Your draft is still here.";
  if (code === "22023")
    return "Check the outcome, callback date and note (up to 4,000 characters).";
  return "The save could not be confirmed. Your draft is still here; retrying the same save will not duplicate it.";
}
