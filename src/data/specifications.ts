export type Specification = {
  label: string
  value: string | string[]
}

export const specifications: Record<string, Specification[]> = {
  'oxide-rack': [
    { label: 'System Configuration', value: 'Up to 24 Sleds' },
    {
      label: 'vCPU (Guest Available)',
      value: 'Up to 7,875',
    },
    {
      label: 'Memory (Guest Available)',
      value: 'Up to 30.6 TiB',
    },
    {
      label: 'NVMe Block Storage (Guest Available)',
      value: 'Up to 1.7 PiB',
    },
    { label: 'Network Bandwidth', value: '12.8 Tbit/s' },
    { label: 'Compute Sleds (Hardware Total)', value: 'Up to 24' },
    {
      label: 'CPU Cores / Threads (Hardware Total)',
      value: 'Up to 4,608 / 9,216',
    },
    {
      label: 'DRAM (Hardware Total)',
      value: 'Up to 36 TiB',
    },
    {
      label: 'Storage (Hardware Total)',
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
    { label: 'Memory Configurations', value: '768 GiB, 1.152 TiB, or 1.5 TiB' },
    {
      label: 'Memory Frequency',
      value: '6400 MT/s',
    },
    { label: 'Storage Capacity', value: '10 × U.2/U.3 NVMe 2.5-inch (15mm) Bays' },
    { label: 'Storage Configurations', value: '10 × Up to 30 TB Gen 4 NVMe' },
    { label: 'Network Connectivity', value: '2 × 100GbE' },
  ],
  disks: [
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
    { label: 'Memory Configurations', value: '768 GiB, 1.152 TiB, or 1.5 TiB' },
    {
      label: 'Memory Frequency',
      value: '6400 MT/s',
    },
  ],
  'network-switch': [
    { label: 'ASIC', value: 'Intel Tofino 2' },
    { label: 'Switching Capacity', value: '6.4 Tbit/s' },
    { label: 'Packets Per Second', value: 'Up to 6 Bpps (Billion Packets per Second)' },
    { label: 'Packet Buffer', value: '64 MB' },
    { label: 'Uplink Ports', value: '32 × 40/100/200GBASE QSFP-56' },
    { label: 'Backplane Ports', value: '32 × 100GBASE-KR4' },
    {
      label: 'Supported Optics',
      value: [
        '40GBASE-LR4',
        '100GBASE-CWDM4 / FR1 / LR4',
        '100GBASE-SR-BiDi / SR4',
        '200GBASE-FR4',
      ],
    },
  ],
  'network-connectors': [
    { label: 'Per-Sled Connectivity', value: '2 × 100GbE' },
    { label: 'Backplane Media', value: '100GBASE-KR4 (cabled backplane)' },
    { label: 'Mating', value: 'Blindmate to cabled backplane' },
    {
      label: 'Signals Carried',
      value: [
        'Data: one link to each Sidecar switch',
        'Management network (separate physical link to SP)',
        'Presence and power-control auxiliaries',
      ],
    },
  ],
  'power-connector': [
    { label: 'Mating', value: 'Blindmate to cabled backplane' },
    { label: 'Bus Voltage', value: '54.5 V DC' },
    { label: 'Source', value: 'Rack DC busbar (fed by power shelves)' },
  ],
  fans: [
    { label: 'Configuration', value: 'Per-sled, rear-mounted' },
    { label: 'Airflow Direction', value: 'Front-to-back' },
    { label: 'Control', value: 'Sled service processor' },
    { label: 'Service Access', value: 'Front of rack (cold aisle)' },
    { label: 'Rack Thermal Output', value: 'Up to 122,832 BTU/hr' },
  ],
  'airflow-shroud': [
    {
      label: 'Function',
      value: 'Channels intake air across CPU and DIMMs to rear fans',
    },
    { label: 'Removal', value: 'Tool-less; lifts off when sled is pulled' },
  ],
  'patch-panel': [
    { label: 'Per-Switch Uplinks', value: '32 × QSFP-56 (40/100/200GBASE)' },
    {
      label: 'Fiber Types',
      value: ['OS2 Single-Mode', 'OM3 / OM4 / OM5 Multi-Mode'],
    },
    { label: 'Connector Types', value: 'LC (Lucent), MPO-8, MPO-12' },
  ],
  'power-shelf': [
    {
      label: 'Typical / Max Output Power',
      value: '2400W / 3600W per power supply',
    },
    { label: 'DC Output', value: 'Up to 18 kW per shelf at 54.5 V to rack busbar' },
    { label: 'Rectifiers', value: '6 hot-swappable per shelf' },
    {
      label: 'Input Voltage (AC)',
      value: ['3 Phase Delta: 208–240V', '3 Phase WYE: 380–480V'],
    },
    { label: 'Input Frequency (AC)', value: '50–60 Hz' },
    { label: 'Power Connector Types', value: 'CS8365C (Delta), L22-20P (Wye)' },
  ],
}
