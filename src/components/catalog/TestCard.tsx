import Link from "next/link";
import { Clock, FileText, BarChart3 } from "lucide-react";
import { Pill } from "@/components/shared/Pill";
import { Card } from "@/components/shared/Card";

export interface TestCardProps {
  id: number;
  name: string;
  description: string | null;
  testType: string | null;
  questionCount: number | null;
  timeLimitMinutes: number | null;
  passingScore: number | null;
  domainNames: string[];
}

export function TestCard({
  id,
  name,
  description,
  testType,
  questionCount,
  timeLimitMinutes,
  domainNames,
}: TestCardProps) {
  return (
    <Card className="flex flex-col gap-3 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading font-semibold text-cco-ink leading-snug">
          {name}
        </h3>
        {testType && (
          <Pill variant={testType === "Static" ? "default" : "purple"}>
            {testType === "Random" ? "Custom" : testType}
          </Pill>
        )}
      </div>

      {description && (
        <p className="text-sm text-cco-muted line-clamp-2">{stripHtml(description)}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {domainNames.map((d) => (
          <Pill key={d} variant="green">
            {d}
          </Pill>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs text-cco-muted mt-auto pt-2 border-t border-cco-border">
        {questionCount != null && (
          <span className="flex items-center gap-1">
            <FileText size={13} />
            {questionCount} questions
          </span>
        )}
        {timeLimitMinutes != null && (
          <span className="flex items-center gap-1">
            <Clock size={13} />
            {timeLimitMinutes} min
          </span>
        )}
      </div>

      <Link
        href={`/exam/start?test_id=${id}`}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-cco-purple text-white text-sm font-semibold no-underline transition hover:bg-cco-purple-600 hover:shadow-lg hover:-translate-y-px"
      >
        <BarChart3 size={15} />
        Start Exam
      </Link>
    </Card>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
