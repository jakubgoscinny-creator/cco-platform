import { TestCard, type TestCardProps } from "./TestCard";

export function TestGrid({ tests }: { tests: TestCardProps[] }) {
  if (!tests.length) {
    return (
      <div className="text-center py-16">
        <p className="text-cco-muted text-lg">No exams found</p>
        <p className="text-cco-muted text-sm mt-1">
          Try adjusting your filters or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {tests.map((test) => (
        <TestCard key={test.id} {...test} />
      ))}
    </div>
  );
}
