export type Specification = {
  label: string
  value: string | string[]
}

export const specifications: Record<string, Specification[]> = {
  'oxide-rack': [
    { label: 'System Configuration', value: 'Up to 24 Sleds' },
    {
      label: 'vCPU (2 per physical core)',
      value: 'Up to 7,875',
    },
    {
      label: 'Memory (DRAM)',
      value: 'Up to 30.6 TiB',
    },
    {
      label: 'NVMe Block Storage',
      value: 'Up to 1.7 PiB',
    },
    { label: 'Network Bandwidth', value: '12.8 Tbit/s' },
    { label: 'Compute Sleds (Total)', value: 'Up to 24' },
    {
      label: 'CPU Cores / Threads',
      value: 'Up to 4,608 / 9,216',
    },
    {
      label: 'Storage',
      value: 'Up to 6.5 PiB',
    },
    { label: 'Network Switches', value: '2' },
    { label: 'Switching Capacity', value: '12.8 Tbit/s' },
    { label: 'Power Shelves', value: '2 (1+1 redundant or 2+0 non-redundant)' },
    { label: 'Power Supplies per Shelf', value: '6 (5+1 or 3+3)' },
    {
      label: 'Max Power Draw',
      value: 'Up to 21.6 kW redundant or 30 kW non-redundant',
    },
    {
      label: 'Dimensions (H × W × D)',
      value: ['2354mm (92.7") height', '600mm (23.7") width', '1060mm (41.8") depth'],
    },
    { label: 'Weight', value: 'Up to ~2,518 lbs (~1,145 kg)' },
    { label: 'Max Thermal Output', value: '122,832 BTU/hr' },
    { label: 'Airflow Requirements', value: '145.8 × kVA CFM' },
  ],
  'compute-sled': [
    { label: 'Processor', value: '1 × AMD EPYC 9005 Series' },
    { label: 'Cores / Threads', value: 'Up to 192 / 384' },
    { label: 'Memory Capacity', value: '12 × DDR5 DIMM Slots' },
    { label: 'Memory Configurations', value: '768 GiB, 1152 GiB, or 1.5 TiB' },
    {
      label: 'Memory Frequency',
      value: '6400 MT/s',
    },
    { label: 'Storage Capacity', value: '10 × U.2/U.3 NVMe 2.5-inch (15mm) Bays' },
    { label: 'Storage Configurations', value: '10 × Up to 30 TB Gen 4 NVMe' },
    { label: 'Network Connectivity', value: '2 × 100GbE' },
  ],
  'disk-group': [
    { label: 'Storage Capacity', value: '10 × U.2/U.3 NVMe 2.5-inch (15mm) Bays' },
    { label: 'Storage Configurations', value: '10 × Up to 30 TB Gen 4 NVMe' },
  ],
  disk: [
    { label: 'Type', value: 'NVMe SSD' },
    { label: 'Capacity', value: 'Up to 30 TB' },
    { label: 'Form Factor', value: 'U.2/U.3 2.5-inch' },
  ],
  'cpu-nested': [
    { label: 'Processor', value: 'AMD EPYC 9005 Series' },
    { label: 'Cores / Threads', value: 'Up to 192 / 384' },
  ],
  cpu: [
    { label: 'Processor', value: 'AMD EPYC 9005 Series' },
    { label: 'Cores / Threads', value: 'Up to 192 / 384' },
  ],
  ram: [
    { label: 'Memory Capacity', value: '12 × DDR5 DIMM Slots' },
    { label: 'Memory Configurations', value: '768 GiB, 1152 GiB, or 1.5 TiB' },
    {
      label: 'Memory Frequency',
      value: '6400 MT/s',
    },
  ],
  'network-switch': [
    { label: 'ASIC', value: 'Intel Tofino 2' },
    { label: 'Switching Capacity', value: '6.4 Tbit/s' },
    { label: 'Packets Per Second', value: 'Up to 6 Bpps (Billion Packet per Second)' },
    { label: 'Packet Buffer', value: '64 MB' },
    { label: 'Uplink Ports', value: '32 × 40/100/200GBASE QSFP-56' },
    { label: 'Backplane Ports', value: '32 × 100GBASE-KR4' },
  ],
  'power-shelf': [
    {
      label: 'Typical / Max Output Power',
      value: '2400W / 3600W per power supply',
    },
    {
      label: 'Input Voltage (AC)',
      value: ['3 Phase Delta: 208–240V', '3 Phase WYE: 380–480V'],
    },
    { label: 'Input Frequency (AC)', value: '50–60 Hz' },
    { label: 'Power Connector Types', value: 'CS8365C (Delta), L22-20P (Wye)' },
  ],
}
