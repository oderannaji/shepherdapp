import { createFileRoute } from "@tanstack/react-router";
import { connection } from "@/features/shepherd/identity";
import { ConnectedFollowUp, FollowUp } from "@/features/shepherd/follow-up";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My people · Shepherd" },
      {
        name: "description",
        content:
          "Your personal church follow-up workspace for Dominion City Manchester. Fictional interactive demo.",
      },
      { property: "og:title", content: "My people · Shepherd" },
      {
        property: "og:description",
        content: "Meaningful connections and ongoing care at Dominion City Manchester.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: connection.mode === "demo" ? FollowUp : ConnectedFollowUp,
});
