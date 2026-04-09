import { Suspense } from "react";
import { getActiveTests, getDomainNames } from "@/lib/sync";
import { TestGrid } from "@/components/catalog/TestGrid";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { DataLineage } from "@/components/shared/DataLineage";
import type { TestCardProps } from "@/components/catalog/TestCard";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const typeFilter = typeof params?.type === "string" ? params.type : "";
  const searchQuery =
    typeof params?.q === "string" ? params.q.toLowerCase() : "";

  const allTests = await getActiveTests();

  // Collect all domain IDs referenced by tests
  const allDomainIds = [
    ...new Set(allTests.flatMap((t) => t.domainIds ?? [])),
  ];
  const domainNameMap = await getDomainNames(allDomainIds);

  // Filter
  let filtered = allTests.filter((t) => {
    if (!t.testName) return false;
    if (typeFilter && t.testType !== typeFilter) return false;
    if (
      searchQuery &&
      !t.testName.toLowerCase().includes(searchQuery) &&
      !stripHtml(t.description ?? "").toLowerCase().includes(searchQuery)
    )
      return false;
    return true;
  });

  // Sort by name
  filtered.sort((a, b) => a.testName.localeCompare(b.testName));

  // Map to card props
  const cards: TestCardProps[] = filtered.map((t) => ({
    id: t.podioItemId,
    name: t.testName,
    description: t.description,
    testType: t.testType,
    questionCount: t.questionCount,
    timeLimitMinutes: t.timeLimitMinutes,
    passingScore: t.passingScore,
    domainNames: (t.domainIds ?? [])
      .map((id) => domainNameMap.get(id))
      .filter((n): n is string => !!n),
  }));

  const latestSync = allTests.reduce<Date | null>((latest, t) => {
    if (!t.syncedAt) return latest;
    const d = new Date(t.syncedAt);
    return !latest || d > latest ? d : latest;
  }, null);

  // Collect unique type values for filters
  const typeValues = [
    ...new Set(allTests.map((t) => t.testType).filter(Boolean)),
  ].sort() as string[];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-cco-ink">
          Test Catalog
        </h1>
        <DataLineage syncedAt={latestSync} />
      </div>

      <Suspense fallback={null}>
        <CatalogFilters typeOptions={typeValues} />
      </Suspense>

      <p className="text-sm text-cco-muted mb-4">
        {filtered.length} exam{filtered.length !== 1 ? "s" : ""} available
      </p>

      <TestGrid tests={cards} />
    </div>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
