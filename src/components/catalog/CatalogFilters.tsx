"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useTransition, useCallback } from "react";

/**
 * Search-only filter. CCO-T044: the old type + course pill rows were dropped —
 * the colour-coded collapsible folders (CatalogGroups) now do the categorising,
 * which is faster (instant, client-side) and far less cluttered.
 */
export function CatalogFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentSearch = searchParams.get("q") ?? "";

  const update = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      startTransition(() => {
        router.replace(`/catalog?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition]
  );

  return (
    <div className="relative mb-6 max-w-md">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-cco-muted"
      />
      <input
        type="search"
        placeholder="Search exams…"
        defaultValue={currentSearch}
        onChange={(e) => update(e.target.value)}
        className="w-full rounded-xl border border-cco-border bg-white py-2.5 pl-9 pr-3 text-sm text-cco-ink focus:border-cco-purple focus:outline-2 focus:outline-cco-purple/25"
      />
    </div>
  );
}
