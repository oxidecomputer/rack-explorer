export const Specifications = () => {
  const specs = [
    { label: 'MODEL', value: 'Cloud Computer' },
    { label: 'VCPU (2 PER PHYSICAL CORE)', value: '3500' },
    { label: 'MEMORY (DRAM)', value: '13.6 or 27.2 TiB' },
    { label: 'NVME BLOCK STORAGE', value: '250 TiB' },
    { label: 'NETWORK BANDWIDTH', value: '12.8 Tbit/s' },
  ]

  return (
    <div className="flex flex-col gap-3">
      {specs.map((spec, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="text-mono-xs text-tertiary uppercase">{spec.label}</div>
          <div className="text-sans-md text-default">{spec.value}</div>
        </div>
      ))}
    </div>
  )
}
