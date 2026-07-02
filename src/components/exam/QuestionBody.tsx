"use client";

import { memo } from "react";
import { QuestionImages } from "@/components/shared/QuestionImages";

interface QuestionBodyProps {
  questionPodioId: number;
  html: string;
}

/**
 * CCO-T067: the question text, rendered from (possibly highlighted) HTML.
 *
 * This is intentionally a `React.memo`'d leaf keyed only on
 * `(questionPodioId, html)`. ExamClient re-renders every second (the TICK
 * timer); without this isolation each TICK reconciles this
 * `dangerouslySetInnerHTML` subtree, which could disturb the user's in-progress
 * text selection or the freshly-applied `<mark>` before they pick a colour —
 * exactly the "loses its highlight before you can action it" regression from
 * the 2026-06-18 QA call. Memoised on its two real inputs, the per-second timer
 * never re-invokes this component, so the live selection + applied highlights
 * survive until the html or the question actually changes.
 *
 * The `id` is the selection target HighlightTools reads
 * (`document.getElementById("tp-question-text-{id}")`). `prose prose-sm` is kept
 * for base typography parity (no `.prose mark` rule exists — `@tailwindcss/typography`
 * is not installed — so it does not fight the inline `!important` highlight marks).
 */
function QuestionBodyImpl({ questionPodioId, html }: QuestionBodyProps) {
  return (
    <>
      <div
        id={`tp-question-text-${questionPodioId}`}
        className="text-cco-ink leading-relaxed prose prose-sm max-w-none question-html"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <QuestionImages key={questionPodioId} podioItemId={questionPodioId} />
    </>
  );
}

export const QuestionBody = memo(QuestionBodyImpl);
