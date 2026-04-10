import clsx from 'clsx'

export function Bar({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div className={clsx('bg-tertiary animate-pulse rounded', className)} style={style} />
  )
}

export function OutlineSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Bar className="h-4 w-24" />
      <div className="my-1 h-px w-full bg-(--stroke-secondary)" />
      <div className="flex flex-col gap-2.5">
        {[20, 28, 24, 28, 20, 28, 24, 20].map((w, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2">
            <div className="bg-tertiary h-4 w-4 animate-pulse rounded" />
            <Bar className="h-3.5" style={{ width: w * 4 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CTASkeleton() {
  return (
    <div className="h-17">
      <Bar className="h-2.5 w-20" />
      <div className="mt-2 flex flex-col gap-1">
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-48" />
        <Bar className="h-3 w-52" />
      </div>
    </div>
  )
}

export function SpecificationsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[
        { labelW: 80, valueW: 100 },
        { labelW: 60, valueW: 120 },
        { labelW: 90, valueW: 80 },
        { labelW: 70, valueW: 110 },
        { labelW: 60, valueW: 100 },
        { labelW: 80, valueW: 90 },
        { labelW: 70, valueW: 100 },
        { labelW: 80, valueW: 110 },
      ].map((item, i) => (
        <div key={i} className="flex flex-col gap-1">
          <Bar className="h-2.5" style={{ width: item.labelW }} />
          <Bar className="h-3.5" style={{ width: item.valueW }} />
        </div>
      ))}
    </div>
  )
}
