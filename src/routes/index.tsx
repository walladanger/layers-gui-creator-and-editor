import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radium Panel Lab Studio" },
      { name: "description", content: "Radium Panel Lab Studio: importing foundation" },
      { property: "og:title", content: "Radium Panel Lab Studio" },
      { property: "og:description", content: "Radium Panel Lab Studio: importing foundation" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <h1 className="text-center text-xl font-medium">
        Radium Panel Lab Studio: importing foundation
      </h1>
    </main>
  );
}
