import { mergeProps, splitProps } from 'solid-js';
import type { Patient, PatientCondition } from '~/stores/emsStore';

interface EmsPatientCardProps {
  patient: Patient;
  selected: boolean;
  getPriorityColor: (priority: number) => string;
  getConditionColor: (condition: PatientCondition) => string;
  formatDate: (dateStr: string) => string;
  onSelect: (patient: Patient) => void;
}

export function EmsPatientCard(props: EmsPatientCardProps) {
  const merged = mergeProps(
    {
      selected: false,
    },
    props
  );
  const [local] = splitProps(merged, [
    'patient',
    'selected',
    'getPriorityColor',
    'getConditionColor',
    'formatDate',
    'onSelect',
  ] as const);

  return (
    <div
      class={`patient-card ${local.patient.condition.toLowerCase()} priority-${local.patient.triagePriority} ${local.selected ? 'selected' : ''}`}
      onClick={() => local.onSelect(local.patient)}
    >
      <div class="patient-header">
        <span class="patient-id">{local.patient.patientId}</span>
        <span
          class="patient-priority"
          style={{ color: local.getPriorityColor(local.patient.triagePriority) }}
        >
          [P{local.patient.triagePriority}]
        </span>
        <span
          class="patient-condition"
          style={{ color: local.getConditionColor(local.patient.condition) }}
        >
          [{local.patient.condition}]
        </span>
        <span class="patient-time">{local.formatDate(local.patient.triagedAt)}</span>
      </div>
      <div class="patient-name">{local.patient.name}</div>
      <div class="patient-complaint">{local.patient.chiefComplaint}</div>
      <div class="patient-status-badge">{local.patient.status}</div>
    </div>
  );
}
