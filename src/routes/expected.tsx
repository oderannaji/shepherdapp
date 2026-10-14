import { connection } from "@/features/shepherd/identity";
import { createFileRoute } from "@tanstack/react-router";
import { Expected, ConnectedExpected } from "@/features/shepherd/expected";
export const Route = createFileRoute("/expected")({
  head: () => ({
    meta: [
      { title: "Expected · Shepherd" },
      {
        name: "description",
        content:
          "Share Sunday invitations, record arrivals and celebrate church connections. Fictional interactive demo.",
      },
      { property: "og:title", content: "Expected · Shepherd" },
      {
        property: "og:description",
        content: "Personal invitations, shared anticipation, one church family.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: connection.mode === "demo" ? Expected : ConnectedExpected,
});
