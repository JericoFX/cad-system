import {
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { appActions } from '~/stores/appStore';
import { cadActions, type Person, type Vehicle } from '~/stores/cadStore';
import {
  terminalActions,
  terminalState,
  type VehicleQuickLock,
} from '~/stores/terminalStore';
import { fetchNui } from '~/utils/fetchNui';
import { Button, Modal, Tabs } from '~/components/ui';
import { EntitySearchToolbar } from './EntitySearchToolbar';
import { EntityNoteEditor } from './EntityNoteEditor';
import { ImportantNotesListSection } from './ImportantNotesListSection';

type ScanResult = {
  plate: string;
  model: string;
  distance: number;
  scannedAt: number;
};

type LookupVehicle = Vehicle;
type LookupPerson = Person;

type LookupVehiclesResponse = { vehicles: LookupVehicle[] };
type LookupPersonsResponse = { persons: LookupPerson[] };

type QuickSummary = {
  plate: string;
  model: string;
  ownerId?: string;
  ownerName?: string;
  riskLevel: 'NONE' | 'MEDIUM' | 'HIGH';
  riskTags: string[];
  noteHint?: string;
  vehicle?: LookupVehicle;
};

type EntityNote = {
  id: string;
  entityType: 'PERSON' | 'VEHICLE';
  entityId: string;
  author: string;
  authorName?: string;
  content: string;
  important: boolean;
  timestamp: string;
};

type NotesResponse = {
  notes: EntityNote[];
};

type StopLog = {
  stopId: string;
  plate: string;
  vehicleModel: string;
  ownerIdentifier?: string;
  ownerName?: string;
  riskLevel: 'NONE' | 'MEDIUM' | 'HIGH';
  riskTags: string[];
  noteHint?: string;
  createdAt: string;
  officer?: string;
};

type StopLogsResponse = {
  stops: StopLog[];
};

type ReaderVehicle = {
  plate: string;
  model: string;
  make: string;
  year: number;
  color: string;
  ownerId: string;
  ownerName: string;
  vin: string;
  registrationStatus: 'VALID' | 'EXPIRED' | 'SUSPENDED';
  insuranceStatus: 'VALID' | 'EXPIRED' | 'NONE';
  stolen: boolean;
  flags: string[];
  createdAt: string;
};

type ReaderPerson = {
  citizenid: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ssn: string;
  phone?: string;
  address?: string;
  bloodType?: string;
  allergies?: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  photo?: string;
  createdAt: string;
  lastUpdated: string;
  isDead: boolean;
};

type ReaderResponse = {
  ok: boolean;
  documentType?: 'PERSON' | 'VEHICLE';
  vehicle?: ReaderVehicle;
  person?: ReaderPerson;
};

type VehicleReaderContext = {
  ok: boolean;
  hasReader?: boolean;
  endpointId?: string;
};

type ReaderDocument = {
  slot: number;
  name: string;
  label: string;
};

type ReaderListResponse = {
  ok: boolean;
  documents?: ReaderDocument[];
  expectedSlot?: number;
};

function normalizePlate(value: string): string {
  return value.trim().toUpperCase();
}

function toVehicleRecord(input: ReaderVehicle): LookupVehicle {
  return {
    plate: input.plate,
    model: input.model,
    make: input.make,
    year: input.year,
    color: input.color,
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    vin: input.vin,
    registrationStatus: input.registrationStatus,
    insuranceStatus: input.insuranceStatus,
    stolen: input.stolen,
    flags: Array.isArray(input.flags) ? input.flags : [],
    createdAt: input.createdAt,
  };
}

function toPersonRecord(input: ReaderPerson): LookupPerson {
  return {
    citizenid: input.citizenid,
    firstName: input.firstName,
    lastName: input.lastName,
    dateOfBirth: input.dateOfBirth,
    ssn: input.ssn,
    phone: input.phone,
    address: input.address,
    bloodType: input.bloodType,
    allergies: input.allergies,
    gender: input.gender,
    photo: input.photo,
    createdAt: input.createdAt,
    lastUpdated: input.lastUpdated,
    isDead: input.isDead,
  };
}

export function VehicleCAD() {
  const [tab, setTab] = createSignal<'vehicle' | 'person' | 'notes'>('vehicle');
  const [vehicleQuery, setVehicleQuery] = createSignal('');
  const [personQuery, setPersonQuery] = createSignal('');
  const [vehicles, setVehicles] = createSignal<LookupVehicle[]>([]);
  const [persons, setPersons] = createSignal<LookupPerson[]>([]);
  const [selectedVehicle, setSelectedVehicle] =
    createSignal<LookupVehicle | null>(null);
  const [selectedPerson, setSelectedPerson] = createSignal<LookupPerson | null>(
    null,
  );
  const [readerStatus, setReaderStatus] = createSignal('ID SLOT: UNKNOWN');
  const [loadingScan, setLoadingScan] = createSignal(false);
  const [loadingSearch, setLoadingSearch] = createSignal(false);
  const [loadingNotes, setLoadingNotes] = createSignal(false);
  const [vehicleNotes, setVehicleNotes] = createSignal<EntityNote[]>([]);
  const [personNotes, setPersonNotes] = createSignal<EntityNote[]>([]);
  const [recentStops, setRecentStops] = createSignal<StopLog[]>([]);
  const [noteContent, setNoteContent] = createSignal('');
  const [importantNote, setImportantNote] = createSignal(true);

  const quickLock = createMemo(() => terminalState.vehicleQuickLock);

  const quickRiskColor = createMemo(() => {
    if (!quickLock()) return 'var(--terminal-fg-dim)';
    if (quickLock()!.riskLevel === 'HIGH')
      return 'var(--terminal-error-bright)';
    if (quickLock()!.riskLevel === 'MEDIUM')
      return 'var(--terminal-system-bright)';
    return 'var(--priority-low)';
  });

  const resolveReaderEndpoint = async (): Promise<string | null> => {
    try {
      const vehicleReader = await fetchNui<VehicleReaderContext>(
        'cad:vehicle:getReaderContext',
      );
      if (
        vehicleReader.ok &&
        vehicleReader.hasReader &&
        vehicleReader.endpointId
      ) {
        return vehicleReader.endpointId;
      }
    } catch {}

    return null;
  };

  const refreshReaderStatus = async () => {
    const endpointId = await resolveReaderEndpoint();
    if (!endpointId) {
      setReaderStatus('ID SLOT: NO READER');
      return;
    }

    try {
      const response = await fetchNui<{ slots?: Array<{ slot: number }> }>(
        'cad:idreader:getContainer',
        {
          terminalId: endpointId,
        },
      );

      const occupied = Array.isArray(response.slots)
        ? response.slots.length
        : 0;
      setReaderStatus(
        occupied > 0 ? `ID SLOT: OCCUPIED (${occupied})` : 'ID SLOT: EMPTY',
      );
    } catch {
      setReaderStatus('ID SLOT: UNKNOWN');
    }
  };

  const searchVehicles = async (query: string) => {
    const clean = query.trim();
    if (!clean) {
      setVehicles([]);
      return;
    }

    setLoadingSearch(true);
    try {
      const response = await fetchNui<LookupVehiclesResponse>(
        'cad:lookup:searchVehicles',
        {
          query: clean,
          limit: 15,
        },
      );

      const rows = Array.isArray(response.vehicles) ? response.vehicles : [];
      setVehicles(rows);
      rows.forEach((vehicle) => cadActions.addVehicle(vehicle));
    } catch (error) {
      terminalActions.addLine(
        `Vehicle search failed: ${String(error)}`,
        'error',
      );
    } finally {
      setLoadingSearch(false);
    }
  };

  const searchPersons = async (query: string) => {
    const clean = query.trim();
    if (!clean) {
      setPersons([]);
      return;
    }

    setLoadingSearch(true);
    try {
      const response = await fetchNui<LookupPersonsResponse>(
        'cad:lookup:searchPersons',
        {
          query: clean,
          limit: 15,
        },
      );

      const rows = Array.isArray(response.persons) ? response.persons : [];
      setPersons(rows);
      rows.forEach((person) => cadActions.addPerson(person));
    } catch (error) {
      terminalActions.addLine(
        `Person search failed: ${String(error)}`,
        'error',
      );
    } finally {
      setLoadingSearch(false);
    }
  };

  const loadVehicleNotes = async (plate: string) => {
    const cleanPlate = normalizePlate(plate);
    if (!cleanPlate) {
      setVehicleNotes([]);
      return;
    }

    setLoadingNotes(true);
    try {
      const response = await fetchNui<NotesResponse>('cad:entityNotes:list', {
        entityType: 'VEHICLE',
        entityId: cleanPlate,
        limit: 25,
      });

      setVehicleNotes(Array.isArray(response.notes) ? response.notes : []);
    } catch (error) {
      terminalActions.addLine(
        `Vehicle notes failed: ${String(error)}`,
        'error',
      );
    } finally {
      setLoadingNotes(false);
    }
  };

  const loadPersonNotes = async (citizenId: string) => {
    const cleanId = citizenId.trim();
    if (!cleanId) {
      setPersonNotes([]);
      return;
    }

    setLoadingNotes(true);
    try {
      const response = await fetchNui<NotesResponse>('cad:entityNotes:list', {
        entityType: 'PERSON',
        entityId: cleanId,
        limit: 25,
      });

      setPersonNotes(Array.isArray(response.notes) ? response.notes : []);
    } catch (error) {
      terminalActions.addLine(`Person notes failed: ${String(error)}`, 'error');
    } finally {
      setLoadingNotes(false);
    }
  };

  const loadStops = async (plate?: string) => {
    try {
      const response = await fetchNui<StopLogsResponse>(
        'cad:vehicle:getRecentStops',
        {
          plate: plate || '',
          limit: 8,
        },
      );

      setRecentStops(Array.isArray(response.stops) ? response.stops : []);
    } catch (error) {
      terminalActions.addLine(
        `Stop log unavailable: ${String(error)}`,
        'error',
      );
    }
  };

  const lockFront = async (scan: ScanResult) => {
    const summary = await fetchNui<QuickSummary>('cad:vehicle:quickSummary', {
      plate: scan.plate,
      model: scan.model,
    });

    const lockPayload: VehicleQuickLock = {
      plate: summary.plate,
      model: summary.model,
      riskLevel: summary.riskLevel,
      riskTags: Array.isArray(summary.riskTags) ? summary.riskTags : [],
      noteHint: summary.noteHint,
      ownerId: summary.ownerId,
      ownerName: summary.ownerName,
      distance: scan.distance,
      scannedAt: scan.scannedAt,
    };

    const stop = await fetchNui<{ stopId?: string }>('cad:vehicle:logStop', {
      plate: lockPayload.plate,
      model: lockPayload.model,
      ownerId: lockPayload.ownerId,
      ownerName: lockPayload.ownerName,
      riskLevel: lockPayload.riskLevel,
      riskTags: lockPayload.riskTags,
      noteHint: lockPayload.noteHint,
      stopSource: 'TABLET',
    });

    lockPayload.stopId = stop.stopId;
    terminalActions.setVehicleQuickLock(lockPayload);

    if (summary.vehicle) {
      cadActions.addVehicle(summary.vehicle);
      setSelectedVehicle(summary.vehicle);
      setVehicleQuery(summary.vehicle.plate);
      await loadVehicleNotes(summary.vehicle.plate);
      await loadStops(summary.vehicle.plate);
    } else {
      await searchVehicles(summary.plate);
    }

    if (summary.ownerId) {
      await searchPersons(summary.ownerId);
      const owner =
        persons().find((person) => person.citizenid === summary.ownerId) ||
        null;
      if (owner) {
        setSelectedPerson(owner);
        await loadPersonNotes(owner.citizenid);
      }
    }

    terminalActions.addLine(
      `Front lock: ${summary.plate} (${summary.riskLevel}${summary.riskTags.length > 0 ? ` / ${summary.riskTags.join(', ')}` : ''})`,
      'output',
    );
  };

  const runManualScan = async () => {
    if (loadingScan()) return;

    setLoadingScan(true);
    try {
      const scan = await fetchNui<ScanResult>('cad:vehicle:scanFront', {
        maxDistance: 70,
      });
      await lockFront(scan);
    } catch (error) {
      terminalActions.addLine(`Manual scan failed: ${String(error)}`, 'error');
    } finally {
      setLoadingScan(false);
    }
  };

  const insertDocument = async () => {
    const endpointId = await resolveReaderEndpoint();
    if (!endpointId) {
      setReaderStatus('ID SLOT: NO READER');
      terminalActions.addLine('No reader endpoint available', 'error');
      return;
    }

    try {
      const list = await fetchNui<ReaderListResponse>(
        'cad:idreader:listDocuments',
        {
          terminalId: endpointId,
        },
      );

      const docs = Array.isArray(list.documents) ? list.documents : [];
      if (!list.ok || docs.length === 0) {
        terminalActions.addLine('No documents available for reader', 'error');
        return;
      }

      const selected = docs[0];
      await fetchNui('cad:idreader:insert', {
        terminalId: endpointId,
        inventorySlot: selected.slot,
        slot: list.expectedSlot || 1,
      });

      await refreshReaderStatus();
      terminalActions.addLine(`Reader insert ok (${selected.label})`, 'output');
    } catch (error) {
      terminalActions.addLine(`Insert failed: ${String(error)}`, 'error');
    }
  };

  const ejectDocument = async () => {
    const endpointId = await resolveReaderEndpoint();
    if (!endpointId) {
      setReaderStatus('ID SLOT: NO READER');
      terminalActions.addLine('No reader endpoint available', 'error');
      return;
    }

    try {
      await fetchNui('cad:idreader:eject', {
        terminalId: endpointId,
      });

      await refreshReaderStatus();
      terminalActions.addLine('Reader ejected', 'output');
    } catch (error) {
      terminalActions.addLine(`Eject failed: ${String(error)}`, 'error');
    }
  };

  const readInsertedDocument = async () => {
    const endpointId = await resolveReaderEndpoint();
    if (!endpointId) {
      setReaderStatus('ID SLOT: NO READER');
      terminalActions.addLine('No reader endpoint available', 'error');
      return;
    }

    try {
      const response = await fetchNui<ReaderResponse>('cad:idreader:read', {
        terminalId: endpointId,
      });

      if (!response.ok) {
        terminalActions.addLine('Reader returned no document', 'error');
        return;
      }

      if (response.documentType === 'VEHICLE' && response.vehicle) {
        const vehicle = toVehicleRecord(response.vehicle);
        cadActions.addVehicle(vehicle);
        setSelectedVehicle(vehicle);
        setTab('vehicle');
        setVehicleQuery(vehicle.plate);
        await loadVehicleNotes(vehicle.plate);
        await loadStops(vehicle.plate);
        terminalActions.addLine(
          `Reader vehicle loaded: ${vehicle.plate}`,
          'output',
        );
        return;
      }

      if (response.documentType === 'PERSON' && response.person) {
        const person = toPersonRecord(response.person);
        cadActions.addPerson(person);
        setSelectedPerson(person);
        setTab('person');
        setPersonQuery(person.citizenid);
        await loadPersonNotes(person.citizenid);
        terminalActions.addLine(
          `Reader person loaded: ${person.firstName} ${person.lastName}`,
          'output',
        );
        return;
      }

      terminalActions.addLine('Reader returned unknown document', 'error');
    } catch (error) {
      terminalActions.addLine(`Reader failed: ${String(error)}`, 'error');
    }
  };

  const addNote = async (
    entityType: 'PERSON' | 'VEHICLE',
    entityId: string,
  ) => {
    const content = noteContent().trim();
    if (!content) {
      terminalActions.addLine('Write a note first', 'error');
      return;
    }

    try {
      await fetchNui('cad:entityNotes:add', {
        entityType,
        entityId,
        content,
        important: importantNote(),
      });

      setNoteContent('');
      if (entityType === 'VEHICLE') {
        await loadVehicleNotes(entityId);
      } else {
        await loadPersonNotes(entityId);
      }
      terminalActions.addLine(
        `${entityType} note saved (${entityId})`,
        'output',
      );
    } catch (error) {
      terminalActions.addLine(`Could not save note: ${String(error)}`, 'error');
    }
  };

  const createCaseFromStop = () => {
    const lock = quickLock();
    const selectedP = selectedPerson();
    const selectedV = selectedVehicle();
    const now = new Date().toLocaleString();

    const initialTitle = selectedV
      ? `Traffic stop - ${selectedV.plate}`
      : lock
        ? `Traffic stop - ${lock.plate}`
        : 'Traffic stop';

    const initialDescription = [
      `Source: Vehicle Tablet`,
      `Created: ${now}`,
      lock ? `Locked Plate: ${lock.plate}` : null,
      lock
        ? `Risk: ${lock.riskLevel}${lock.riskTags.length > 0 ? ` (${lock.riskTags.join(', ')})` : ''}`
        : null,
      selectedV
        ? `Vehicle: ${selectedV.year} ${selectedV.make} ${selectedV.model}`
        : null,
      selectedP
        ? `Person: ${selectedP.firstName} ${selectedP.lastName} (${selectedP.citizenid})`
        : null,
      lock?.noteHint ? `Hint: ${lock.noteHint}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    terminalActions.setActiveModal('CASE_CREATOR', {
      personId: selectedP?.citizenid,
      personName: selectedP
        ? `${selectedP.firstName} ${selectedP.lastName}`
        : undefined,
      initialTitle,
      initialDescription,
      initialPriority: lock?.riskLevel === 'HIGH' ? 1 : 2,
    });
  };

  const closeModal = () => {
    void fetchNui('cad:vehicle:setOpen', { open: false }).catch(() => {});
    terminalActions.setActiveModal(null);

    if (!terminalState.isInPoliceVehicle) {
      appActions.hide();
    }
  };

  onMount(() => {
    void fetchNui('cad:vehicle:setOpen', { open: true }).catch(() => {});
    void refreshReaderStatus();
    void loadStops();

    const modalData =
      (terminalState.modalData as { plate?: string } | null) || null;
    if (modalData?.plate) {
      setVehicleQuery(modalData.plate);
      void searchVehicles(modalData.plate);
    }
  });

  onCleanup(() => {
    void fetchNui('cad:vehicle:setOpen', { open: false }).catch(() => {});
  });

  return (
    <Modal.Root
      onClose={closeModal}
      closeOnOverlay={false}
      useContentWrapper={false}
      overlayStyle={{
        'background-color': 'rgba(0, 0, 0, 0.72)',
        padding: '12px',
      }}
    >
      <div
        class='modal-content'
        style={{
          width: 'min(96vw, 1600px)',
          height: 'min(92vh, 980px)',
          display: 'flex',
          'flex-direction': 'column',
        }}
      >
        <div class='modal-header'>
          <h2>VEHICLE TABLET - TRAFFIC STOP</h2>
          <div style={{ color: quickRiskColor(), 'font-size': '12px' }}>
            {quickLock()
              ? `LOCK ${quickLock()!.plate} / ${quickLock()!.riskLevel}`
              : 'NO FRONT LOCK'}
          </div>
          <button class='modal-close' onClick={closeModal}>
            [X]
          </button>
        </div>

        <div
          style={{
            padding: '10px',
            display: 'flex',
            gap: '8px',
            'flex-wrap': 'wrap',
          }}
        >
          <Button.Root
            class='btn btn-primary'
            onClick={() => void runManualScan()}
            disabled={loadingScan()}
          >
            [{loadingScan() ? 'SCANNING...' : 'LOCK FRONT'}]
          </Button.Root>
          <Button.Root class='btn' onClick={() => void readInsertedDocument()}>
            [READ ID]
          </Button.Root>
          <Button.Root class='btn' onClick={() => void insertDocument()}>
            [INSERT ID]
          </Button.Root>
          <Button.Root class='btn' onClick={() => void ejectDocument()}>
            [EJECT]
          </Button.Root>
          <Button.Root class='btn' onClick={createCaseFromStop}>
            [CREATE CASE]
          </Button.Root>
          <span
            style={{ color: 'var(--terminal-fg-dim)', 'align-self': 'center' }}
          >
            {readerStatus()}
          </span>
        </div>

        <Tabs.Root
          value={tab()}
          onValueChange={(value) =>
            setTab(value as 'vehicle' | 'person' | 'notes')
          }
          style={{ margin: '0 10px' }}
        >
          <Tabs.List>
            <Tabs.Trigger value='vehicle' label='VEHICLES' />
            <Tabs.Trigger value='person' label='PERSONS' />
            <Tabs.Trigger value='notes' label='NOTES & STOPS' />
          </Tabs.List>
        </Tabs.Root>

        <div style={{ flex: '1', overflow: 'auto', padding: '10px' }}>
          <Show when={tab() === 'vehicle'}>
            <EntitySearchToolbar
              query={vehicleQuery()}
              placeholder='Plate / owner / model'
              loading={loadingSearch()}
              onQueryChange={setVehicleQuery}
              onSearch={() => void searchVehicles(vehicleQuery())}
            />

            <div class='search-content'>
              <div class='search-results-panel'>
                <For each={vehicles()}>
                  {(vehicle) => (
                    <div
                      class={`result-item ${selectedVehicle()?.plate === vehicle.plate ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedVehicle(vehicle);
                        void loadVehicleNotes(vehicle.plate);
                        void loadStops(vehicle.plate);
                      }}
                    >
                      <div class='result-plate'>{vehicle.plate}</div>
                      <div class='result-vehicle'>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </div>
                      <div class='result-color'>Owner: {vehicle.ownerName}</div>
                    </div>
                  )}
                </For>
                <Show when={vehicles().length === 0}>
                  <div class='dispatch-empty'>No vehicles in results.</div>
                </Show>
              </div>

              <div class='vehicle-details-panel'>
                <Show
                  when={selectedVehicle()}
                  fallback={<div class='dispatch-empty'>Select vehicle.</div>}
                >
                  <div class='info-grid'>
                    <div class='info-item'>
                      <label>Plate</label>
                      <span class='value plate-value'>
                        {selectedVehicle()!.plate}
                      </span>
                    </div>
                    <div class='info-item'>
                      <label>Owner</label>
                      <span class='value'>{selectedVehicle()!.ownerName}</span>
                    </div>
                    <div class='info-item full-width'>
                      <label>Vehicle</label>
                      <span class='value'>
                        {selectedVehicle()!.year} {selectedVehicle()!.make}{' '}
                        {selectedVehicle()!.model}
                      </span>
                    </div>
                    <div class='info-item full-width'>
                      <label>Flags</label>
                      <span class='value'>
                        {selectedVehicle()!.flags.length > 0
                          ? selectedVehicle()!.flags.join(', ')
                          : 'NONE'}
                      </span>
                    </div>
                  </div>

                  <EntityNoteEditor
                    content={noteContent()}
                    important={importantNote()}
                    placeholder='Vehicle note...'
                    saveLabel='SAVE VEHICLE NOTE'
                    onContentChange={setNoteContent}
                    onToggleImportant={() => setImportantNote(!importantNote())}
                    onSave={() => void addNote('VEHICLE', selectedVehicle()!.plate)}
                  />
                </Show>
              </div>
            </div>
          </Show>

          <Show when={tab() === 'person'}>
            <EntitySearchToolbar
              query={personQuery()}
              placeholder='Citizen ID / first / last'
              loading={loadingSearch()}
              onQueryChange={setPersonQuery}
              onSearch={() => void searchPersons(personQuery())}
            />

            <div class='search-content'>
              <div class='search-results-panel'>
                <For each={persons()}>
                  {(person) => (
                    <div
                      class={`result-item ${selectedPerson()?.citizenid === person.citizenid ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedPerson(person);
                        void loadPersonNotes(person.citizenid);
                      }}
                    >
                      <div class='result-name'>
                        {person.firstName} {person.lastName}
                      </div>
                      <div class='result-id'>CID: {person.citizenid}</div>
                      <div class='result-meta'>
                        DOB: {person.dateOfBirth || 'UNKNOWN'}
                      </div>
                    </div>
                  )}
                </For>
                <Show when={persons().length === 0}>
                  <div class='dispatch-empty'>No persons in results.</div>
                </Show>
              </div>

              <div class='vehicle-details-panel'>
                <Show
                  when={selectedPerson()}
                  fallback={<div class='dispatch-empty'>Select person.</div>}
                >
                  <div class='info-grid'>
                    <div class='info-item'>
                      <label>Name</label>
                      <span class='value'>
                        {selectedPerson()!.firstName}{' '}
                        {selectedPerson()!.lastName}
                      </span>
                    </div>
                    <div class='info-item'>
                      <label>Citizen ID</label>
                      <span class='value'>{selectedPerson()!.citizenid}</span>
                    </div>
                    <div class='info-item'>
                      <label>DOB</label>
                      <span class='value'>
                        {selectedPerson()!.dateOfBirth || 'UNKNOWN'}
                      </span>
                    </div>
                    <div class='info-item'>
                      <label>Phone</label>
                      <span class='value'>
                        {selectedPerson()!.phone || 'UNKNOWN'}
                      </span>
                    </div>
                  </div>

                  <EntityNoteEditor
                    content={noteContent()}
                    important={importantNote()}
                    placeholder='Person note...'
                    saveLabel='SAVE PERSON NOTE'
                    onContentChange={setNoteContent}
                    onToggleImportant={() => setImportantNote(!importantNote())}
                    onSave={() => void addNote('PERSON', selectedPerson()!.citizenid)}
                  />
                </Show>
              </div>
            </div>
          </Show>

          <Show when={tab() === 'notes'}>
            <div class='dispatch-grid'>
              <ImportantNotesListSection
                title='VEHICLE IMPORTANT NOTES'
                notes={vehicleNotes()}
                loading={loadingNotes()}
                emptyMessage='No notes for selected vehicle.'
              />

              <ImportantNotesListSection
                title='PERSON IMPORTANT NOTES'
                notes={personNotes()}
                loading={loadingNotes()}
                emptyMessage='No notes for selected person.'
              />

              <div class='dispatch-section'>
                <h3>RECENT STOP LOG</h3>
                <For each={recentStops()}>
                  {(stop) => (
                    <div class='dispatch-item'>
                      <div class='dispatch-item-header'>
                        <span class='dispatch-item-title'>{stop.plate}</span>
                        <span>{stop.riskLevel}</span>
                      </div>
                      <div class='dispatch-item-meta'>
                        {new Date(stop.createdAt).toLocaleString()} -{' '}
                        {stop.vehicleModel || 'UNKNOWN'}
                      </div>
                      <Show when={stop.noteHint}>
                        <div class='dispatch-item-meta'>{stop.noteHint}</div>
                      </Show>
                    </div>
                  )}
                </For>
                <Show when={recentStops().length === 0}>
                  <div class='dispatch-empty'>No recent stops.</div>
                </Show>
              </div>
            </div>
          </Show>
        </div>

        <div class='modal-footer'>
          <span>
            {quickLock()
              ? `LOCKED ${quickLock()!.plate} / ${quickLock()!.riskLevel} / ${quickLock()!.riskTags.join(', ') || 'NONE'}`
              : 'NO LOCKED FRONT VEHICLE'}
          </span>
          <Button.Root class='btn' onClick={closeModal}>
            [CLOSE]
          </Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
