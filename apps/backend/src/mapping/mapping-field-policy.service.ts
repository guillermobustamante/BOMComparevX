import { Injectable } from '@nestjs/common';
import { CanonicalField, MappingFieldClass, MappingProfile } from './mapping-contract';

@Injectable()
export class MappingFieldPolicyService {
  classifyField(field: CanonicalField | null, profiles: MappingProfile[] = []): MappingFieldClass | null {
    if (!field) return null;
    const active = new Set(profiles);

    if (['assembly', 'parent_path', 'find_number', 'level', 'zone', 'room', 'spec_section', 'ifc_class', 'cobie_attribute'].includes(field)) {
      return 'display';
    }

    if (['cost', 'supplier', 'supplier_code', 'plant', 'program', 'vehicle_line', 'ppap_status', 'tooling_status', 'service_part_flag', 'effectivity', 'effectivity_from', 'effectivity_to', 'serial_range', 'lot', 'compliance_status', 'hazard_class', 'rohs', 'reach', 'lifecycle_risk', 'location', 'discipline', 'install_phase', 'revision_package', 'approved_supplier', 'criticality', 'airworthiness_class'].includes(field)) {
      return 'business_impact';
    }

    if (active.has('electronics') || active.has('ipc_bom')) {
      if (['manufacturer_part_number', 'reference_designator'].includes(field)) {
        return 'identity';
      }
    }

    if (active.has('aerospace')) {
      if (['drawing_number', 'dash_number'].includes(field)) {
        return 'identity';
      }
    }

    if (['part_number', 'revision', 'customer_part_number'].includes(field)) {
      return 'identity';
    }

    return 'comparable';
  }
}
