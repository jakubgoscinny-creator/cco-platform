"use client";

import { useState, useTransition } from "react";
import { startExamAction } from "@/actions/exam";
import { Play, Loader2 } from "lucide-react";

export function StartExamButton({ testPodioId }: { testPodioId: number }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const result = await startExamAction(testPodioId);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-3">
          {error}
        </div>
      )}
      <button
        onClick={handleStart}
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-cco-purple text-white font-semibold transition hover:bg-cco-purple-600 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Loading questions...
          </>
        ) : (
          <>
            <Play size={18} />
            Begin Exam
          </>
        )}
      </button>
    </div>
  );
}
