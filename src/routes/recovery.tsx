import { connection } from "@/features/shepherd/identity";
import { createFileRoute } from "@tanstack/react-router";
import { Recovery, ConnectedRecovery } from "@/features/shepherd/recovery";
export const Route = createFileRoute("/recovery")({
  head: () => ({
    meta: [
      { title: "Recovery · Shepherd" },
      {
        name: "description",
        content:
          "A weekly church care list to reconnect with people we have missed. Fictional demo.",
      },
      { property: "og:title", content: "Recovery · Shepherd" },
      { property: "og:description", content: "Thoughtful weekly check-ins for our church family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: connection.mode === "demo" ? Recovery : ConnectedRecovery,
});
