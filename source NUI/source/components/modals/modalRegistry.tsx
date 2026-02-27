import { lazy, type Component } from 'solid-js';
import { featureState } from '~/stores/featureStore';
import { terminalActions } from '~/stores/terminalStore';
import { CallsignPrompt } from './CallsignPrompt';
import { PhotoCapturePreview } from './PhotoCapturePreview';

export type ModalId =
  | 'CALLSIGN_PROMPT'
  | 'DISPATCH_PANEL'
  | 'CASE_CREATOR'
  | 'CASE_MANAGER'
  | 'MAP'
  | 'EVIDENCE'
  | 'NOTES'
  | 'NOTES_FILE'
  | 'UPLOAD'
  | 'EVIDENCE_DOCUMENT'
  | 'PERSON_SEARCH'
  | 'VEHICLE_SEARCH'
  | 'FINE_MANAGER'
  | 'POLICE_DASHBOARD'
  | 'EMS_DASHBOARD'
  | 'NEWS_MANAGER'
  | 'RADIO_PANEL'
  | 'LICENSE_MANAGER'
  | 'PROPERTY_MANAGER'
  | 'FLEET_MANAGER'
  | 'ARREST_FORM'
  | 'ARREST_WIZARD'
  | 'PERSON_SNAPSHOT'
  | 'RADIO_MARKERS'
  | 'BOLO_MANAGER'
  | 'VEHICLE_CAD'
  | 'FORENSIC_COLLECTION'
  | 'PHOTO_PREVIEW';

export interface PhotoPreviewData {
  photoId: string;
  photoUrl: string;
  job: 'police' | 'reporter';
  description?: string;
  location: { x: number; y: number; z: number };
  fov?: {
    hit?: boolean;
    hitCoords?: { x: number; y: number; z: number };
    distance?: number;
    entityType?: string;
  };
}

interface ModalContext {
  photoPreviewData: PhotoPreviewData | null;
}

export interface ModalRegistryEntry {
  component: Component<any>;
  enabled?: () => boolean;
  getProps?: (context: ModalContext) => Record<string, unknown> | null;
}

const DispatchTable = lazy(() =>
  import('./DispatchTable').then((module) => ({ default: module.DispatchTable }))
);
const CaseCreator = lazy(() =>
  import('./CaseCreator').then((module) => ({ default: module.CaseCreator }))
);
const CaseManager = lazy(() =>
  import('./CaseManager').then((module) => ({ default: module.CaseManager }))
);
const MapModal = lazy(() =>
  import('./MapModal').then((module) => ({ default: module.MapModal }))
);
const EvidenceManager = lazy(() =>
  import('./EvidenceManager').then((module) => ({ default: module.EvidenceManager }))
);
const NotesEditor = lazy(() =>
  import('./NotesEditor').then((module) => ({ default: module.NotesEditor }))
);
const NotesFileManager = lazy(() =>
  import('./NotesFileManager').then((module) => ({ default: module.NotesFileManager }))
);
const EvidenceUploader = lazy(() =>
  import('./EvidenceUploader').then((module) => ({ default: module.EvidenceUploader }))
);
const EvidenceDocumentViewer = lazy(() =>
  import('./EvidenceDocumentViewer').then((module) => ({ default: module.EvidenceDocumentViewer }))
);
const PersonSearch = lazy(() =>
  import('./PersonSearch').then((module) => ({ default: module.PersonSearch }))
);
const VehicleSearch = lazy(() =>
  import('./VehicleSearch').then((module) => ({ default: module.VehicleSearch }))
);
const FineManager = lazy(() =>
  import('./FineManager').then((module) => ({ default: module.FineManager }))
);
const PoliceDashboard = lazy(() =>
  import('./PoliceDashboard').then((module) => ({ default: module.PoliceDashboard }))
);
const EMSDashboard = lazy(() =>
  import('./EMSDashboard').then((module) => ({ default: module.EMSDashboard }))
);
const NewsManager = lazy(() =>
  import('./NewsManager').then((module) => ({ default: module.NewsManager }))
);
const RadioPanel = lazy(() =>
  import('./RadioPanel').then((module) => ({ default: module.RadioPanel }))
);
const LicenseManager = lazy(() =>
  import('./LicenseManager').then((module) => ({ default: module.LicenseManager }))
);
const PropertyManager = lazy(() =>
  import('./PropertyManager').then((module) => ({ default: module.PropertyManager }))
);
const FleetManager = lazy(() =>
  import('./FleetManager').then((module) => ({ default: module.FleetManager }))
);
const ArrestForm = lazy(() =>
  import('./ArrestForm').then((module) => ({ default: module.ArrestForm }))
);
const ArrestWizard = lazy(() =>
  import('./ArrestWizard').then((module) => ({ default: module.ArrestWizard }))
);
const PersonSnapshot = lazy(() =>
  import('./PersonSnapshot').then((module) => ({ default: module.PersonSnapshot }))
);
const RadioMarkers = lazy(() =>
  import('./RadioMarkers').then((module) => ({ default: module.RadioMarkers }))
);
const BoloManager = lazy(() =>
  import('./BoloManager').then((module) => ({ default: module.BoloManager }))
);
const VehicleCAD = lazy(() =>
  import('./VehicleCAD').then((module) => ({ default: module.VehicleCAD }))
);
const ForensicCollection = lazy(() =>
  import('./ForensicCollection').then((module) => ({ default: module.ForensicCollection }))
);

const CallsignPromptSetup: Component = () => <CallsignPrompt mode='setup' />;

export const modalRegistry: Record<ModalId, ModalRegistryEntry> = {
  CALLSIGN_PROMPT: {
    component: CallsignPromptSetup,
  },
  DISPATCH_PANEL: {
    component: DispatchTable,
    enabled: () => featureState.dispatch.visible,
  },
  CASE_CREATOR: {
    component: CaseCreator,
  },
  CASE_MANAGER: {
    component: CaseManager,
  },
  MAP: {
    component: MapModal,
    enabled: () => featureState.map.visible,
  },
  EVIDENCE: {
    component: EvidenceManager,
  },
  NOTES: {
    component: NotesEditor,
  },
  NOTES_FILE: {
    component: NotesFileManager,
  },
  UPLOAD: {
    component: EvidenceUploader,
  },
  EVIDENCE_DOCUMENT: {
    component: EvidenceDocumentViewer,
  },
  PERSON_SEARCH: {
    component: PersonSearch,
  },
  VEHICLE_SEARCH: {
    component: VehicleSearch,
  },
  FINE_MANAGER: {
    component: FineManager,
  },
  POLICE_DASHBOARD: {
    component: PoliceDashboard,
  },
  EMS_DASHBOARD: {
    component: EMSDashboard,
    enabled: () => featureState.ems.visible,
  },
  NEWS_MANAGER: {
    component: NewsManager,
    enabled: () => featureState.news.visible,
  },
  RADIO_PANEL: {
    component: RadioPanel,
    enabled: () => featureState.radio.visible,
  },
  LICENSE_MANAGER: {
    component: LicenseManager,
  },
  PROPERTY_MANAGER: {
    component: PropertyManager,
  },
  FLEET_MANAGER: {
    component: FleetManager,
  },
  ARREST_FORM: {
    component: ArrestForm,
  },
  ARREST_WIZARD: {
    component: ArrestWizard,
  },
  PERSON_SNAPSHOT: {
    component: PersonSnapshot,
  },
  RADIO_MARKERS: {
    component: RadioMarkers,
    enabled: () => featureState.radio.visible,
  },
  BOLO_MANAGER: {
    component: BoloManager,
  },
  VEHICLE_CAD: {
    component: VehicleCAD,
  },
  FORENSIC_COLLECTION: {
    component: ForensicCollection,
    enabled: () => featureState.forensics.visible,
  },
  PHOTO_PREVIEW: {
    component: PhotoCapturePreview,
    getProps: (context) => {
      if (!context.photoPreviewData) {
        return null;
      }

      return {
        photoData: context.photoPreviewData,
        onClose: () => terminalActions.setActiveModal(null),
      };
    },
  },
};

export function isModalId(value: string | null | undefined): value is ModalId {
  if (!value) {
    return false;
  }

  return value in modalRegistry;
}
