import { createFileRoute } from "@tanstack/react-router";
import { connection } from "@/features/shepherd/identity";
import { ConnectedContact, ContactDetail } from "@/features/shepherd/follow-up";
export const Route = createFileRoute("/people/$id")({
  head: () => ({
    meta: [
      { title: "Personal care · Shepherd" },
      {
        name: "description",
        content: "Church contact details, conversation notes and next follow-up. Demo data only.",
      },
      { property: "og:title", content: "Personal care · Shepherd" },
      { property: "og:description", content: "Keep personal care connected and thoughtful." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});
function ContactPage() {
  const { id } = Route.useParams();
  return connection.mode === "demo" ? (
    <ContactDetail key={id} id={id} />
  ) : (
    <ConnectedContact key={id} id={id} />
  );
}
