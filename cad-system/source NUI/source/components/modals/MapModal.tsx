import { createMemo, createSignal, Show } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadState, cadActions } from '~/stores/cadStore';
import { userState } from '~/stores/userStore';
import type { MapMarker, MapRef } from '../Map.types';
import type { DispatchCall } from '~/stores/cadStore';

type MapModalData = {
  returnModal?: string;
};

const Map = (await import('../Map')).default;

export function MapModal() {
  const [selectedMarker, setSelectedMarker] = createSignal<string | null>(null);
  const [selectedMarkerType, setSelectedMarkerType] = createSignal<
    'unit' | 'dispatch' | null
  >(null);
  const [showDosMode, setShowDosMode] = createSignal(true);
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [newCallTitle, setNewCallTitle] = createSignal('');
  const [newCallPriority, setNewCallPriority] = createSignal(2);
  const [clickCoords, setClickCoords] = createSignal<[number, number] | null>(
    null,
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [mapRef, setMapRef] = createSignal<MapRef | null>(null);
  const [showAssignForm, setShowAssignForm] = createSignal(false);
  const [selectedUnitToAssign, setSelectedUnitToAssign] =
    createSignal<string>('');

  const selectedCall = createMemo<DispatchCall | undefined>(() => {
    const markerId = selectedMarker();
    if (!markerId || selectedMarkerType() !== 'dispatch') return undefined;
    return cadState.dispatchCalls[markerId];
  });

  const linkedCaseForSelectedCall = createMemo(() => {
    const call = selectedCall();
    if (!call) return undefined;
    return Object.values(cadState.cases).find(
      (caseItem) => caseItem.linkedCallId === call.callId,
    );
  });

  const isSelectedCallCustom = createMemo(() => {
    const call = selectedCall();
    return call?.type === 'CUSTOM';
  });

  const unitMarkers = createMemo<MapMarker[]>(() => {
    const currentBadge = userState.currentUser?.badge || '';
    const currentUserId = userState.currentUser?.id || '';

    const markers = Object.values(cadState.dispatchUnits)
      .filter((u) => u.location)
      .map((unit) => {
        const isCurrentUnit =
          (currentBadge && unit.badge === currentBadge) ||
          (currentUserId && unit.name.toLowerCase().includes(currentUserId.toLowerCase()));

        return {
        id: unit.unitId,
        position: [unit.location!.x, unit.location!.y] as [number, number],
        type: 'unit' as const,
        label: isCurrentUnit ? 'YOU' : unit.unitId,
        tooltip: isCurrentUnit
          ? `Your Position - ${unit.name} (${unit.status})`
          : `${unit.name} (${unit.status})`,
        color: isCurrentUnit ? 'green-168' : unit.status === 'BUSY' ? 'red-168' : 'green-168',
        icon: isCurrentUnit ? '🧭' : unit.status === 'BUSY' ? '🔴' : '🟢',
        onClick: () => {
          setSelectedMarker(unit.unitId);
          setSelectedMarkerType('unit');
          setShowDeleteConfirm(false);
        },
        onDblClick: () => {
          console.log(unit.location!.x, unit.location!.y);
          mapRef()?.setCenter([unit.location!.x, unit.location!.y]);
        },
      };
      });
    console.log(`[Map] Unit markers: ${markers.length}`);
    return markers;
  });

  const callMarkers = createMemo<MapMarker[]>(() => {
    const markers = Object.values(cadState.dispatchCalls)
      .filter(
        (c) =>
          c.coordinates &&
          c.coordinates.x !== undefined &&
          c.coordinates.y !== undefined,
      )
      .map((call) => ({
        id: call.callId,
        position: [call.coordinates!.x, call.coordinates!.y] as [
          number,
          number,
        ],
        type: 'dispatch' as const,
        label: call.callId,
        tooltip: `${call.title} [${call.priority === 1 ? 'HIGH' : call.priority === 2 ? 'MED' : 'LOW'}]`,
        color:
          call.priority === 1
            ? 'red-168'
            : call.priority === 2
              ? 'yellow-168'
              : 'green-168',
        icon: call.priority === 1 ? '❗' : '📍',
        onClick: () => {
          setSelectedMarker(call.callId);
          setSelectedMarkerType('dispatch');
          setShowDeleteConfirm(false);
          setShowAssignForm(false);
        },
        onDblClick: () => {
          mapRef()?.setCenter([call.coordinates!.x, call.coordinates!.y]);
        },
      }));
    console.log(`[Map] Call markers: ${markers.length}`);
    return markers;
  });

  const availableUnits = createMemo(() =>
    Object.values(cadState.dispatchUnits).filter(
      (u) => u.status === 'AVAILABLE',
    ),
  );

  const allMarkers = createMemo(() => [...unitMarkers(), ...callMarkers()]);

  const closeModal = () => {
    const modalData = (terminalState.modalData as MapModalData | null) || null;
    if (modalData?.returnModal) {
      terminalActions.setActiveModal(modalData.returnModal);
      return;
    }

    terminalActions.setActiveModal(null);
  };

  const handleMapClick = (coords: [number, number]) => {
    console.log('Map clicked at:', coords);
    setClickCoords(coords);
    setShowCreateForm(true);
  };

  const handleCreateCall = () => {
    if (!clickCoords() || !newCallTitle().trim()) return;

    const coords = clickCoords()!;
    const callId = `CALL_${Date.now()}`;

    const newCall: DispatchCall = {
      callId,
      type: 'CUSTOM',
      priority: newCallPriority(),
      title: newCallTitle(),
      description: 'Created from map',
      location: `Coords: ${coords[0].toFixed(1)}, ${coords[1].toFixed(1)}`,
      coordinates: { x: coords[0], y: coords[1], z: 0 },
      status: 'PENDING',
      assignedUnits: {},
      createdAt: new Date().toISOString(),
    };

    cadActions.addDispatchCall(newCall);
    terminalActions.addLine(
      `Call created at coordinates: ${coords[0].toFixed(1)}, ${coords[1].toFixed(1)}`,
      'output',
    );

    setShowCreateForm(false);
    setNewCallTitle('');
    setClickCoords(null);
  };

  const handleCreateMarker = () => {
    terminalActions.addLine('Click on the map to create a marker', 'system');
    setShowCreateForm(true);
  };

  const handleDeleteCall = () => {
    const callId = selectedMarker();
    if (!callId || !isSelectedCallCustom()) return;

    cadActions.removeDispatchCall(callId);
    terminalActions.addLine(`Call ${callId} deleted`, 'system');
    setSelectedMarker(null);
    setSelectedMarkerType(null);
    setShowDeleteConfirm(false);
  };

  const initiateDelete = () => {
    if (!isSelectedCallCustom()) return;
    setShowDeleteConfirm(true);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleAssignUnit = () => {
    const callId = selectedMarker();
    const unitId = selectedUnitToAssign();

    if (!callId || !unitId || selectedMarkerType() !== 'dispatch') return;

    const call = cadState.dispatchCalls[callId];
    if (!call) return;

    const updatedAssignedUnits = {
      ...call.assignedUnits,
      [unitId]: { assignedAt: new Date().toISOString() },
    };

    cadActions.updateDispatchCall(callId, {
      assignedUnits: updatedAssignedUnits,
      status: 'ACTIVE',
    });

    cadActions.updateDispatchUnit(unitId, {
      status: 'BUSY',
      currentCall: callId,
    });

    terminalActions.addLine(
      `Unit ${unitId} assigned to call ${callId}`,
      'output',
    );
    setShowAssignForm(false);
    setSelectedUnitToAssign('');
  };

  const toggleAssignForm = () => {
    if (selectedMarkerType() === 'dispatch' && selectedMarker()) {
      setShowAssignForm(!showAssignForm());
      setSelectedUnitToAssign('');
    }
  };

  const createCaseFromSelectedCall = () => {
    const call = selectedCall();
    if (!call) return;

    const linkedCase = linkedCaseForSelectedCall();
    if (linkedCase) {
      terminalActions.addLine(
        `Opening existing case ${linkedCase.caseId} linked to ${call.callId}`,
        'system',
      );
      terminalActions.setActiveModal('CASE_MANAGER', { caseId: linkedCase.caseId });
      return;
    }

    terminalActions.setActiveModal('CASE_CREATOR', {
      linkedCallId: call.callId,
      linkedUnits: Object.keys(call.assignedUnits),
      initialTitle: call.title,
      initialDescription: call.description,
      initialPriority: call.priority,
    });
  };

  return (
    <div class='modal-overlay' onClick={closeModal}>
      <div class='modal-content map-modal' onClick={(e) => e.stopPropagation()}>
        <div class='modal-header'>
          <h2>=== TACTICAL MAP ===</h2>
          <div
            style={{ display: 'flex', gap: '10px', 'align-items': 'center' }}
          >
            <Show
              when={selectedMarker() && selectedMarkerType() === 'dispatch'}
            >
              <button
                class='modal-close'
                onClick={createCaseFromSelectedCall}
                style={{ 'margin-right': '10px', color: '#00ffff' }}
              >
                [{linkedCaseForSelectedCall() ? 'OPEN CASE' : 'CREATE CASE'}]
              </button>
              <button
                class='modal-close'
                onClick={toggleAssignForm}
                style={{ 'margin-right': '10px', color: '#00ff00' }}
              >
                [ASSIGN UNIT]
              </button>
            </Show>
            <Show
              when={
                selectedMarker() &&
                selectedMarkerType() === 'dispatch' &&
                isSelectedCallCustom()
              }
            >
              <Show
                when={!showDeleteConfirm()}
                fallback={
                  <>
                    <span style={{ color: '#ff0000', 'font-size': '14px' }}>
                      Confirm delete?
                    </span>
                    <button
                      class='modal-close'
                      onClick={handleDeleteCall}
                      style={{ 'margin-right': '5px', color: '#ff0000' }}
                    >
                      [YES]
                    </button>
                    <button
                      class='modal-close'
                      onClick={cancelDelete}
                      style={{ 'margin-right': '10px' }}
                    >
                      [NO]
                    </button>
                  </>
                }
              >
                <button
                  class='modal-close'
                  onClick={initiateDelete}
                  style={{ 'margin-right': '10px', color: '#ff0000' }}
                >
                  [DELETE]
                </button>
              </Show>
            </Show>
            <button
              class='modal-close'
              onClick={() => terminalActions.setActiveModal('DISPATCH_PANEL')}
              style={{ 'margin-right': '10px', color: '#00ffff' }}
            >
              [DISPATCH]
            </button>
            <button
              class='modal-close'
              onClick={handleCreateMarker}
              style={{ 'margin-right': '10px' }}
            >
              [+ MARKER]
            </button>
            <button
              class='modal-close'
              onClick={() => setShowDosMode(!showDosMode())}
              style={{ 'margin-right': '10px' }}
            >
              [{showDosMode() ? 'COLOR' : 'DOS'}]
            </button>
            <button class='modal-close' onClick={closeModal}>
              [X]
            </button>
          </div>
        </div>

        <Show when={showAssignForm()}>
          <div class='map-create-form'>
            <div class='form-label'>[ASSIGN UNIT TO CALL]</div>
            <div style={{ color: '#00ff00', 'margin-bottom': '10px' }}>
              Call: {selectedCall()?.callId} - {selectedCall()?.title}
            </div>
            <Show
              when={availableUnits().length > 0}
              fallback={
                <div style={{ color: '#ff0000', 'margin-bottom': '10px' }}>
                  No available units to assign
                </div>
              }
            >
              <div style={{ 'margin-bottom': '10px' }}>
                <label
                  style={{
                    color: '#c0c0c0',
                    display: 'block',
                    'margin-bottom': '5px',
                  }}
                >
                  Select Unit:
                </label>
                <select
                  class='dos-input'
                  value={selectedUnitToAssign()}
                  onChange={(e) =>
                    setSelectedUnitToAssign(e.currentTarget.value)
                  }
                  style={{ width: '100%' }}
                >
                  <option value=''>-- Select Unit --</option>
                  {availableUnits().map((unit) => (
                    <option value={unit.unitId}>
                      {unit.unitId} - {unit.name} ({unit.type})
                    </option>
                  ))}
                </select>
              </div>
            </Show>
            <div class='form-actions'>
              <button
                class='btn btn-primary'
                onClick={handleAssignUnit}
                disabled={
                  !selectedUnitToAssign() || availableUnits().length === 0
                }
              >
                [ASSIGN]
              </button>
              <button
                class='btn'
                onClick={() => {
                  setShowAssignForm(false);
                  setSelectedUnitToAssign('');
                }}
              >
                [CANCEL]
              </button>
            </div>
          </div>
        </Show>

        <Show when={showCreateForm()}>
          <div class='map-create-form'>
            <div class='form-label'>[CREATE NEW CALL]</div>
            <Show
              when={clickCoords()}
              fallback={
                <div style={{ color: '#ffff00', 'margin-bottom': '10px' }}>
                  Click on the map to set location
                </div>
              }
            >
              <div style={{ color: '#00ff00', 'margin-bottom': '10px' }}>
                Location: {clickCoords()![0].toFixed(1)},{' '}
                {clickCoords()![1].toFixed(1)}
              </div>
            </Show>
            <input
              type='text'
              class='dos-input'
              value={newCallTitle()}
              onInput={(e) => setNewCallTitle(e.currentTarget.value)}
              placeholder='Enter call title...'
            />
            <div class='priority-selector'>
              <button
                class={`priority-btn ${newCallPriority() === 1 ? 'selected high' : ''}`}
                onClick={() => setNewCallPriority(1)}
              >
                [HIGH]
              </button>
              <button
                class={`priority-btn ${newCallPriority() === 2 ? 'selected med' : ''}`}
                onClick={() => setNewCallPriority(2)}
              >
                [MED]
              </button>
              <button
                class={`priority-btn ${newCallPriority() === 3 ? 'selected low' : ''}`}
                onClick={() => setNewCallPriority(3)}
              >
                [LOW]
              </button>
            </div>
            <div class='form-actions'>
              <button
                class='btn btn-primary'
                onClick={handleCreateCall}
                disabled={!clickCoords() || !newCallTitle().trim()}
              >
                [CREATE]
              </button>
              <button
                class='btn'
                onClick={() => {
                  setShowCreateForm(false);
                  setClickCoords(null);
                }}
              >
                [CANCEL]
              </button>
            </div>
          </div>
        </Show>

        <div class='map-container-dos'>
          <Map
            markers={allMarkers()}
            height='450px'
            width='100%'
            dosMode={showDosMode()}
            scanlines={showDosMode()}
            phosphorColor='green'
            filterMode='phosphor'
            showControls={true}
            onMapClick={handleMapClick}
            mapRef={setMapRef}
          />
        </div>

        <div class='map-info-dos'>
          <div class='info-section'>
            <h3>[UNITS: {unitMarkers().length}]</h3>
            <div class='marker-list'>
              {unitMarkers().map((marker) => (
                <div
                  class={`marker-item ${selectedMarker() === marker.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedMarker(marker.id);
                    setSelectedMarkerType('unit');
                    setShowDeleteConfirm(false);
                  }}
                  onDblClick={() => {
                    mapRef()?.setCenter([marker.position[0], marker.position[1]]);
                  }}
                >
                  <span
                    style={{
                      color: marker.color === 'red-168' ? '#ff0000' : '#00ff00',
                    }}
                  >
                    {marker.icon}
                  </span>
                  {marker.id} - {marker.tooltip}
                </div>
              ))}
              {unitMarkers().length === 0 && (
                <div class='marker-empty'>No units with location</div>
              )}
            </div>
          </div>

          <div class='info-section'>
            <h3>[CALLS: {callMarkers().length}]</h3>
            <div class='marker-list'>
              {callMarkers().map((marker) => (
                <div
                  class={`marker-item ${selectedMarker() === marker.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedMarker(marker.id);
                    setSelectedMarkerType('dispatch');
                    setShowDeleteConfirm(false);
                  }}
                  onDblClick={() => {
                    mapRef()?.setCenter([marker.position[0], marker.position[1]]);
                  }}
                >
                  <span
                    style={{
                      color:
                        marker.color === 'red-168'
                          ? '#ff0000'
                          : marker.color === 'yellow-168'
                            ? '#ffff00'
                            : '#00ff00',
                    }}
                  >
                    {marker.icon}
                  </span>
                  {marker.tooltip}
                  {marker.id.startsWith('CALL_') && (
                    <span
                      style={{
                        color: '#00ff00',
                        'margin-left': '8px',
                        'font-size': '12px',
                      }}
                    >
                      [CUSTOM]
                    </span>
                  )}
                </div>
              ))}
              {callMarkers().length === 0 && (
                <div class='marker-empty'>No calls with coordinates</div>
              )}
            </div>
          </div>
        </div>

        <div class='modal-footer'>
          <span style={{ color: '#808080', 'font-size': '14px' }}>
            Total markers: {allMarkers().length}
          </span>
          <button class='btn' onClick={closeModal}>
            [CLOSE]
          </button>
        </div>
      </div>
    </div>
  );
}
