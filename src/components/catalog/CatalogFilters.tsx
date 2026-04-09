"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useTransition, useCallback } from "react";

export function CatalogFilters({ typeOptions }: { typeOptions: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentType = searchParams.get("type") ?? "";
  const currentSearch = searchParams.get("q") ?? "";

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      startTransition(() => {
        router.replace(`/catalog?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition]
  );

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-cco-muted"
        />
        <input
          type="search"
          placeholder="Search exams..."
          defaultValue={currentSearch}
          onChange={(e) => updateParams("q", e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 bg-white text-cco-ink border border-cco-border rounded-xl text-sm focus:outline-2 focus:outline-cco-purple/25 focus:border-cco-purple"
        />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => updateParams("type", "")}
          className={`px-3.5 py-2 rounded-full text-sm font-semibold transition ${
            currentType === ""
              ? "bg-cco-purple text-white"
              : "bg-white border border-cco-border text-cco-muted hover:bg-cco-bg-soft hover:text-cco-purple"
          }`}
        >
          All
        </button>
        {typeOptions.map((opt) => (
          <button
            key={opt}
            onClick={() => updateParams("type", opt)}
            className={`px-3.5 py-2 rounded-full text-sm font-semibold transition ${
              currentType === opt
                ? "bg-cco-purple text-white"
                : "bg-white border border-cco-border text-cco-muted hover:bg-cco-bg-soft hover:text-cco-purple"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
