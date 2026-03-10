export interface MappingFixture {
  name: string;
  profiles: string[];
  headers: string[];
  sampleRows: Array<Record<string, string | number | null>>;
  expected: Array<{ sourceColumn: string; canonicalField: string | null }>;
}

export const S14_MAPPING_FIXTURES: MappingFixture[] = [
  {
    name: 'manufacturing',
    profiles: ['manufacturing', 'erp_generic'],
    headers: ['Plant', 'Work Center', 'UOM', 'Procurement Type', 'Lead Time', 'Material Group', 'Routing Ref'],
    sampleRows: [
      { Plant: 'PL01', 'Work Center': 'WC-10', UOM: 'EA', 'Procurement Type': 'E', 'Lead Time': 7, 'Material Group': 'FAST', 'Routing Ref': 'RT-1' }
    ],
    expected: [
      { sourceColumn: 'Plant', canonicalField: 'plant' },
      { sourceColumn: 'Work Center', canonicalField: 'work_center' },
      { sourceColumn: 'UOM', canonicalField: 'unit_of_measure' },
      { sourceColumn: 'Procurement Type', canonicalField: 'procurement_type' },
      { sourceColumn: 'Lead Time', canonicalField: 'lead_time' },
      { sourceColumn: 'Material Group', canonicalField: 'material_group' },
      { sourceColumn: 'Routing Ref', canonicalField: 'routing_ref' }
    ]
  },
  {
    name: 'automotive',
    profiles: ['automotive'],
    headers: ['Program', 'Vehicle Line', 'Option Code', 'Engineering Level', 'Change Notice', 'Supplier Code', 'PPAP Status'],
    sampleRows: [
      { Program: 'M1', 'Vehicle Line': 'SUV', 'Option Code': 'A12', 'Engineering Level': 'EL2', 'Change Notice': 'ECN-4', 'Supplier Code': 'SUP-1', 'PPAP Status': 'Approved' }
    ],
    expected: [
      { sourceColumn: 'Program', canonicalField: 'program' },
      { sourceColumn: 'Vehicle Line', canonicalField: 'vehicle_line' },
      { sourceColumn: 'Option Code', canonicalField: 'option_code' },
      { sourceColumn: 'Engineering Level', canonicalField: 'engineering_level' },
      { sourceColumn: 'Change Notice', canonicalField: 'change_notice' },
      { sourceColumn: 'Supplier Code', canonicalField: 'supplier_code' },
      { sourceColumn: 'PPAP Status', canonicalField: 'ppap_status' }
    ]
  },
  {
    name: 'aerospace',
    profiles: ['aerospace'],
    headers: ['Drawing Number', 'Dash Number', 'Serial Range', 'Tail Number', 'Configuration State', 'Airworthiness Class'],
    sampleRows: [
      { 'Drawing Number': 'DWG-100', 'Dash Number': '001', 'Serial Range': 'SN100-SN200', 'Tail Number': 'C-FTST', 'Configuration State': 'Block 2', 'Airworthiness Class': 'Primary' }
    ],
    expected: [
      { sourceColumn: 'Drawing Number', canonicalField: 'drawing_number' },
      { sourceColumn: 'Dash Number', canonicalField: 'dash_number' },
      { sourceColumn: 'Serial Range', canonicalField: 'serial_range' },
      { sourceColumn: 'Tail Number', canonicalField: 'tail_number' },
      { sourceColumn: 'Configuration State', canonicalField: 'configuration_state' },
      { sourceColumn: 'Airworthiness Class', canonicalField: 'airworthiness_class' }
    ]
  },
  {
    name: 'electronics',
    profiles: ['electronics', 'ipc_bom'],
    headers: ['RefDes', 'Footprint', 'Package', 'Manufacturer Part Number', 'RoHS', 'REACH', 'AVL'],
    sampleRows: [
      { RefDes: 'R12', Footprint: '0402', Package: '0402', 'Manufacturer Part Number': 'RC0402-10K', RoHS: 'Compliant', REACH: 'Compliant', AVL: 'AVL-1' }
    ],
    expected: [
      { sourceColumn: 'RefDes', canonicalField: 'reference_designator' },
      { sourceColumn: 'Footprint', canonicalField: 'footprint' },
      { sourceColumn: 'Package', canonicalField: 'package' },
      { sourceColumn: 'Manufacturer Part Number', canonicalField: 'manufacturer_part_number' },
      { sourceColumn: 'RoHS', canonicalField: 'rohs' },
      { sourceColumn: 'REACH', canonicalField: 'reach' },
      { sourceColumn: 'AVL', canonicalField: 'avl' }
    ]
  },
  {
    name: 'construction',
    profiles: ['construction', 'ifc_schedule'],
    headers: ['Asset ID', 'Discipline', 'Spec Section', 'Location', 'Level', 'IFC Class', 'Install Phase'],
    sampleRows: [
      { 'Asset ID': 'A-100', Discipline: 'MEP', 'Spec Section': '23 05 00', Location: 'Level 2', Level: 'L2', 'IFC Class': 'IfcFlowTerminal', 'Install Phase': 'Rough-In' }
    ],
    expected: [
      { sourceColumn: 'Asset ID', canonicalField: 'asset_id' },
      { sourceColumn: 'Discipline', canonicalField: 'discipline' },
      { sourceColumn: 'Spec Section', canonicalField: 'spec_section' },
      { sourceColumn: 'Location', canonicalField: 'location' },
      { sourceColumn: 'Level', canonicalField: 'level' },
      { sourceColumn: 'IFC Class', canonicalField: 'ifc_class' },
      { sourceColumn: 'Install Phase', canonicalField: 'install_phase' }
    ]
  }
];
