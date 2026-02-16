export type Specification = {
  label: string
  value: string | string[]
}

export const specifications: Record<string, Specification[]> = {
  'oxide-rack': [
    { label: 'System Configuration', value: '32 Sleds' },
    {
      label: 'vCPU (2 per physical core)',
      value: '3500',
    },
    {
      label: 'Memory (DRAM)',
      value: '13.6 or 27.2 TiB',
    },
    {
      label: 'NVMe Block Storage',
      value: '250 TiB (32 sleds)',
    },
    { label: 'Network Bandwidth', value: '12.8 Tbit/s' },
    { label: 'Compute Sleds (Total)', value: '32' },
    {
      label: 'Processors (x86 Cores)',
      value: '2048 cores',
    },
    {
      label: 'Storage',
      value: ['465.75 - 931.5 TiB raw', 'Varies by config'],
    },
    { label: 'Network Switches', value: '2' },
    { label: 'Switching Capacity', value: '12.8 Tbit/s' },
    { label: 'Power Shelves', value: 'Up to 2' },
    { label: 'Power Supplies per Shelf', value: '6 (5+1 or 3+3)' },
    { label: 'Typical / Max Power Draw', value: ['12 kW typical', '15 kW maximum'] },
    {
      label: 'Dimensions (H x W x D)',
      value: ['2354mm (92.7") height', '600mm (23.7") width', '1060mm (41.8") depth'],
    },
    { label: 'Weight', value: 'Up to ~2,518 lbs (~1,145 kg)' },
    { label: 'Max Thermal Output', value: '61,416 BTU/hr' },
    { label: 'Airflow Requirements', value: '145.8 x kVA CFM' },
  ],
  'compute-sled': [
    { label: 'Processor', value: 'AMD EPYC 7713P' },
    { label: 'Cores / Threads', value: '64 / 128' },
    { label: 'Memory Capacity', value: '16 x DDR4 DIMM Slots' },
    { label: 'Memory Configurations', value: '512 GiB or 1 TiB' },
    {
      label: 'Memory Frequency',
      value: ['3200 MT/s (512 GiB config)', '2933 MT/s (1 TiB config)'],
    },
    { label: 'Storage Capacity', value: ['10 x U.2/U.3', '2.5-inch (15mm) Bays'] },
    { label: 'Storage Configurations', value: '10 x 3.2 TB NVMe' },
    { label: 'Network Connectivity', value: '2 x 100GbE' },
  ],
  'disk-group': [
    { label: 'Storage Capacity', value: '10 x U.2/U.3 2.5-inch (15mm) Bays' },
    { label: 'Storage Configurations', value: '10 x 3.2 TB NVMe' },
  ],
  disk: [
    { label: 'Type', value: 'NVMe SSD' },
    { label: 'Capacity', value: '3.2 TB' },
    { label: 'Form Factor', value: 'U.2/U.3 2.5-inch' },
  ],
  'cpu-nested': [
    { label: 'Processor', value: 'AMD EPYC 7713P' },
    { label: 'Cores / Threads', value: '64 / 128' },
  ],
  cpu: [
    { label: 'Processor', value: 'AMD EPYC 7713P' },
    { label: 'Cores / Threads', value: '64 / 128' },
  ],
  ram: [
    { label: 'Memory Capacity', value: '16 x DDR4 DIMM Slots' },
    { label: 'Memory Configurations', value: '512 GiB or 1 TiB' },
    {
      label: 'Memory Frequency',
      value: ['3200 MT/s (512 GiB config)', '2933 MT/s (1 TiB config)'],
    },
  ],
  'network-switch': [
    { label: 'ASIC', value: 'Intel Tofino 2' },
    { label: 'Switching Capacity', value: '6.4 Tbit/s' },
    { label: 'Packets Per Second', value: 'Up to 6 Bpps (Billion Packet per Second)' },
    { label: 'Packet Buffer', value: '64 MB' },
    { label: 'Uplink Ports', value: '32x 40/100/200GBASE QSFP-56' },
    { label: 'Backplane Ports', value: '32x 100GBASE-KR4' },
  ],
  'power-shelf': [
    {
      label: 'Typical / Max Output Power',
      value: ['2400W typical per supply', '3600W maximum per supply'],
    },
    { label: 'Input Voltage (AC) - Delta', value: '208-240V 3 Phase' },
    { label: 'Input Voltage (AC) - Wye', value: '380-480V 3 Phase' },
    { label: 'Input Frequency (AC)', value: '50 - 60 Hz' },
    { label: 'Power Connector Types', value: 'CS8365C (Delta), L22-20P (Wye)' },
  ],
}
