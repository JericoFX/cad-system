import { splitProps } from 'solid-js';
import type { Patient, PatientCondition } from '~/stores/emsStore';
import { Button } from '~/components/ui';

interface EmsTreatmentCardProps {
  patient: Patient;
  getConditionColor: (condition: PatientCondition) => string;
  formatDate: (dateStr: string) => string;
  onDischarge: (patient: Patient) => void;
}

export function EmsTreatmentCard(props: EmsTreatmentCardProps) {
  const [local] = splitProps(props, ['patient', 'getConditionColor', 'formatDate', 'onDischarge'] as const);

  return (
    <div class="treatment-card">
      <div class="treatment-header">
        <span class="patient-name">{local.patient.name}</span>
        <span
          class="condition-badge"
          style={{ color: local.getConditionColor(local.patient.condition) }}
        >
          P{local.patient.triagePriority} - {local.patient.condition}
        </span>
      </div>
      <div class="treatment-info">
        <p>
          <strong>ID:</strong> {local.patient.patientId}
        </p>
        <p>
          <strong>Chief Complaint:</strong> {local.patient.chiefComplaint}
        </p>
        <p>
          <strong>Admitted:</strong>{' '}
          {local.formatDate(local.patient.admittedAt || local.patient.triagedAt)}
        </p>
        <p>
          <strong>Treatments:</strong> {local.patient.treatments.length}
        </p>
      </div>
      <div class="treatment-actions">
        <Button.Root class="btn btn-success" onClick={() => local.onDischarge(local.patient)}>
          [DISCHARGE]
        </Button.Root>
      </div>
    </div>
  );
}
