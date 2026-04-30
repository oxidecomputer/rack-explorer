import { OpenLink12Icon } from '@oxide/design-system/icons/react'

import { CTASkeleton } from './Skeletons'

export function ContactSales({
  loading,
  className,
}: {
  loading?: boolean
  className?: string
}) {
  return (
    <a href="https://oxide.computer/contact" target="_blank" className={className}>
      {loading ? (
        <CTASkeleton />
      ) : (
        <>
          <div className="text-mono-xs text-tertiary flex items-center justify-between">
            Contact Sales <OpenLink12Icon className="text-quaternary" />
          </div>
          <p className="text-default text-sans-sm mt-1 max-w-90 pr-2">
            Discuss your computing requirements and business goals with our team of experts.
          </p>
        </>
      )}
    </a>
  )
}
