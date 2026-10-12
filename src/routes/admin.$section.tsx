import { createFileRoute } from "@tanstack/react-router";
import { Admin } from "@/features/shepherd/admin";
export const Route = createFileRoute("/admin/$section")({
  head: ({ params }) => ({
    meta: [
      {
        title: `${params.section.charAt(0).toUpperCase() + params.section.slice(1)} · Shepherd Admin`,
      },
      {
        name: "description",
        content: `Shepherd ${params.section} workspace for church administration. Fictional demo, not real authorisation.`,
      },
      { property: "og:title", content: `Shepherd Admin · ${params.section}` },
      {
        property: "og:description",
        content: `Manage church care and Sunday connections in the ${params.section} demo workspace.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});
function AdminPage() {
  const { section } = Route.useParams();
  return <Admin key={section} section={section} />;
}
