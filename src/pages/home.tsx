import { Button } from "@/components/ui/button";

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-5">
      <h1 className="text-lg font-semibold">ClassHopper</h1>
      <Button asChild>
        <a href="/app">进入网页版</a>
      </Button>
    </main>
  );
}
