export function SkeletonBox({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 ${className ?? ''}`}
      {...rest}
    />
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2">
      <SkeletonBox className="h-8 w-48" />
      <SkeletonBox className="h-4 w-72 max-w-full" />
    </div>
  );
}

/** Grade de cards estilo dashboard */
export function DashboardStatGridSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="card p-5 flex items-center gap-4">
          <SkeletonBox className="h-12 w-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBox className="h-3 w-24" />
            <SkeletonBox className="h-7 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeaderSkeleton />
      <DashboardStatGridSkeleton cards={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 space-y-3">
          <SkeletonBox className="h-5 w-40" />
          <SkeletonBox className="h-40 w-full rounded-lg" />
        </div>
        <div className="card p-5 space-y-3">
          <SkeletonBox className="h-5 w-36" />
          <SkeletonBox className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function TableListSkeleton({
  rows = 8,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBox key={i} className="h-3 flex-1 max-w-[120px]" />
        ))}
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-2 px-4 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <SkeletonBox key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListPageSkeleton({
  tableRows = 8,
  showFilters = true,
}: {
  tableRows?: number;
  showFilters?: boolean;
}) {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeaderSkeleton />
      {showFilters && (
        <div className="mb-4 flex flex-wrap gap-3">
          <SkeletonBox className="h-10 w-40 rounded-lg" />
          <SkeletonBox className="h-10 w-40 rounded-lg" />
          <SkeletonBox className="h-10 w-28 rounded-lg ml-auto" />
        </div>
      )}
      <TableListSkeleton rows={tableRows} />
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex gap-3 mb-6">
        <SkeletonBox className="h-9 w-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <SkeletonBox className="h-8 w-56" />
          <SkeletonBox className="h-4 w-32" />
        </div>
      </div>
      <div className="card p-5 space-y-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonBox className="h-3 w-20" />
              <SkeletonBox className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
      <SkeletonBox className="h-32 w-full rounded-xl" />
    </div>
  );
}

export function CobrancaPanelSkeleton() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBox key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonBox className="h-72 rounded-xl" />
        <SkeletonBox className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export function FormPageSkeleton() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeaderSkeleton />
      <div className="card p-6 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonBox className="h-3 w-24" />
            <SkeletonBox className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <div className="flex gap-2 pt-4">
          <SkeletonBox className="h-10 w-28 rounded-lg" />
          <SkeletonBox className="h-10 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
