import { createEffect, createMemo, createSignal, createSelector, For, onCleanup, onMount, Show } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import {
  cadActions,
  cadState,
  type DispatchCall,
  type SecurityCamera,
} from '~/stores/cadStore';
import { radioActions } from '~/stores/radioStore';
import { fetchNui } from '~/utils/fetchNui';
import { useNui } from '~/hooks/useNui';
import { newsActions } from '~/stores/newsStore';
import { Button, Modal } from '~/components/ui';
import {
  DEFAULT_DISPATCH_SETTINGS,
  cameraArrayToRecord,
  isDispatchCall,
  isGuardError,
  normalizeDispatchSettings,
  type CameraListResponse,
  type CameraRemoveResponse,
  type CameraStatusResponse,
  type CameraWatchResponse,
  type DispatchGuardError,
  type DispatchSettings,
} from './dispatchTable.utils';
import {
  calculateDispatchMetrics,
  filterAvailableDispatchUnits,
  filterDispatchCalls,
  formatCallAge,
  getCallSlaLabel,
  getCallSlaLevel,
  getDispatchChannelForUnit,
  getRecommendedUnit,
  mapAssignedUnits,
  priorityLabel,
  selectDispatchCall,
  sortCameraGrid,
  sortDispatchCalls,
} from './dispatchTable.selectors';
import { DispatchCallCard } from './DispatchCallCard';
import { DispatchCCTVGrid } from './DispatchCCTVGrid';
import { DispatchUnitActionRow } from './DispatchUnitActionRow';

export function DispatchTable() {
  const [selectedCallId, setSelectedCallId] = createSignal<string | null>(null);
  const isCallSelected = createSelector(selectedCallId);
  const [dispatchSettings, setDispatchSettings] = createSignal<DispatchSettings>(DEFAULT_DISPATCH_SETTINGS);
  const [nowMs, setNowMs] = createSignal(Date.now());
  const [searchQuery, setSearchQuery] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<'ALL' | 'PENDING' | 'ACTIVE' | 'CLOSED'>('ALL');
  const [priorityFilter, setPriorityFilter] = createSignal<'ALL' | '1' | '2' | '3'>('ALL');
  const [unitTypeFilter, setUnitTypeFilter] = createSignal<'ALL' | 'PATROL' | 'EMS' | 'SUPERVISOR'>('ALL');
  const [creatingCall, setCreatingCall] = createSignal(false);
  const [cameraLoading, setCameraLoading] = createSignal(false);
  const [watchingCameraId, setWatchingCameraId] = createSignal<string | null>(null);
  const [callForm, setCallForm] = createSignal({
    title: '',
    type: 'GENERAL',
    priority: '2',
    location: '',
    description: '',
  });

  const callTypeOptions = createMemo(() => dispatchSettings().callTypeOptions);

  useNui('camera:viewStarted', (data) => {
    if (!data || !data.camera || !data.camera.cameraId) {
      return;
    }

    setWatchingCameraId(data.camera.cameraId);
  });

  useNui('camera:viewStopped', () => {
    setWatchingCameraId(null);
  });

  const allCalls = createMemo(() =>
    sortDispatchCalls(
      Object.values(cadState.dispatchCalls).filter(
        (c) => c.status === 'ACTIVE' || c.status === 'PENDING'
      )
    )
  );

  const allUnits = createMemo(() => Object.values(cadState.dispatchUnits));

  const cameraGrid = createMemo(() => sortCameraGrid(Object.values(cadState.securityCameras)));

  const activeWatchedCamera = createMemo(() => {
    const cameraId = watchingCameraId();
    if (!cameraId) {
      return null;
    }

    return cadState.securityCameras[cameraId] || null;
  });

  const metrics = createMemo(() => calculateDispatchMetrics(allCalls(), allUnits()));

  const unitBoardSummary = createMemo(() => ({
    total: allUnits().length,
    available: allUnits().filter((unit) => unit.status === 'AVAILABLE').length,
    busy: allUnits().filter((unit) => unit.status === 'BUSY').length,
    enroute: allUnits().filter((unit) => unit.status === 'ENROUTE').length,
  }));

  const visibleCalls = createMemo(() =>
    filterDispatchCalls(allCalls(), searchQuery(), statusFilter(), priorityFilter())
  );

  const selectedCall = createMemo(() => selectDispatchCall(visibleCalls(), selectedCallId()));

  const availableUnits = createMemo(() => filterAvailableDispatchUnits(allUnits(), unitTypeFilter()));

  const selectedCallAssignedUnits = createMemo(() => mapAssignedUnits(selectedCall(), cadState.dispatchUnits));

  const selectedCallSummary = createMemo(() => {
    const call = selectedCall();
    if (!call) {
      return null;
    }

    return {
      assigned: Object.keys(call.assignedUnits).length,
      availableMatches: availableUnits().length,
      hasLinkedCase: caseByLinkedCallId()[call.callId] === true,
    };
  });

  const getCallSlaLevelFor = (call: DispatchCall) =>
    getCallSlaLevel(call, dispatchSettings(), nowMs());

  const getCallSlaLabelFor = (call: DispatchCall) => getCallSlaLabel(getCallSlaLevelFor(call));

  const recommendedUnit = createMemo(() =>
    getRecommendedUnit(selectedCall(), dispatchSettings(), allUnits())
  );

  const caseByLinkedCallId = createMemo(() => {
    const map: Record<string, true> = {};
    const cases = Object.values(cadState.cases);
    for (let i = 0; i < cases.length; i += 1) {
      const linkedCallId = cases[i].linkedCallId;
      if (linkedCallId) map[linkedCallId] = true;
    }
    return map;
  });

  const formatAge = (iso: string) => formatCallAge(iso, nowMs());

  const getCaseActionLabel = (callId: string) => {
    return caseByLinkedCallId()[callId] ? 'OPEN CASE' : 'CREATE CASE';
  };

  const notifyCallToChannels = (call: DispatchCall, unitIds: string[], prefix = 'Assignment') => {
    if (!call || unitIds.length === 0) {
      return;
    }

    const unitLabels = unitIds.join(', ');
    const msg = `${prefix}: ${call.callId} -> ${unitLabels} | ${call.title}`;

    radioActions.injectSystemMessage('CH-1', msg, 'TEXT', 'DISPATCH', 'DSP');

    const sentChannels = new Set<string>();
    for (let i = 0; i < unitIds.length; i++) {
      const unit = cadState.dispatchUnits[unitIds[i]];
      if (!unit) continue;
      const channelId = getDispatchChannelForUnit(unit);
      if (sentChannels.has(channelId)) continue;
      sentChannels.add(channelId);
      radioActions.injectSystemMessage(channelId, msg, 'TEXT', 'DISPATCH', 'DSP');
    }

    terminalActions.addLine(`Radio notice sent: ${msg}`, 'system');
  };

  const formatCameraNumber = (cameraNumber: number) => String(cameraNumber || 0).padStart(4, '0');

  const getMockCameraBackground = (camera: SecurityCamera | null) => {
    if (camera) {
      return `/cctv-mock.svg?cam=${camera.cameraNumber}`;
    }

    return '/cctv-mock.svg';
  };

  const refreshCameraGrid = async (silent = false) => {
    setCameraLoading(true);

    try {
      const response = await fetchNui<CameraListResponse>('cad:cameras:list', {});
      if (!response || response.ok !== true) {
        terminalActions.addLine(
          `Failed to refresh CCTV grid: ${response?.error || 'unknown_error'}`,
          'error'
        );
        return;
      }

      const cameraList = Array.isArray(response.cameras) ? response.cameras : [];
      cadActions.setSecurityCameras(cameraArrayToRecord(cameraList));

      if (!silent) {
        terminalActions.addLine(`CCTV grid refreshed (${cameraList.length})`, 'system');
      }
    } catch (error) {
      terminalActions.addLine(`Failed to refresh CCTV grid: ${String(error)}`, 'error');
    } finally {
      setCameraLoading(false);
    }
  };

  const watchCamera = async (cameraId: string) => {
    try {
      const response = await fetchNui<CameraWatchResponse>('cad:cameras:watch', { cameraId });
      if (!response || response.ok !== true || !response.camera) {
        terminalActions.addLine(
          `Cannot open camera feed: ${response?.error || 'unknown_error'}`,
          'error'
        );
        return;
      }

      setWatchingCameraId(response.camera.cameraId);
      terminalActions.addLine(
        `Viewing camera #${formatCameraNumber(response.camera.cameraNumber)} (${response.camera.label})`,
        'system'
      );
    } catch (error) {
      terminalActions.addLine(`Cannot open camera feed: ${String(error)}`, 'error');
    }
  };

  const stopWatchingCamera = async (silent = false) => {
    if (!watchingCameraId()) {
      return;
    }

    try {
      await fetchNui<{ ok: boolean; error?: string }>('cad:cameras:stopWatch', {});
      if (!silent) {
        terminalActions.addLine('Camera feed closed', 'system');
      }
    } catch (error) {
      terminalActions.addLine(`Cannot close camera feed: ${String(error)}`, 'error');
    } finally {
      setWatchingCameraId(null);
    }
  };

  const setCameraStatus = async (cameraId: string, status: 'ACTIVE' | 'DISABLED') => {
    try {
      const response = await fetchNui<CameraStatusResponse>('cad:cameras:setStatus', {
        cameraId,
        status,
      });

      if (!response || response.ok !== true || !response.camera) {
        terminalActions.addLine(
          `Cannot update camera status: ${response?.error || 'unknown_error'}`,
          'error'
        );
        return;
      }

      cadActions.upsertSecurityCamera(response.camera);
      terminalActions.addLine(
        `Camera #${formatCameraNumber(response.camera.cameraNumber)} set to ${response.camera.status}`,
        'system'
      );

      if (status === 'DISABLED' && watchingCameraId() === response.camera.cameraId) {
        await stopWatchingCamera(true);
      }
    } catch (error) {
      terminalActions.addLine(`Cannot update camera status: ${String(error)}`, 'error');
    }
  };

  const removeCamera = async (camera: SecurityCamera) => {
    const confirmed = window.confirm(
      `Remove camera #${formatCameraNumber(camera.cameraNumber)} (${camera.label})?`
    );
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetchNui<CameraRemoveResponse>('cad:cameras:remove', {
        cameraId: camera.cameraId,
      });

      if (!response || response.ok !== true || !response.cameraId) {
        terminalActions.addLine(`Cannot remove camera: ${response?.error || 'unknown_error'}`, 'error');
        return;
      }

      cadActions.removeSecurityCamera(response.cameraId);
      terminalActions.addLine(
        `Camera #${formatCameraNumber(camera.cameraNumber)} removed from grid`,
        'system'
      );

      if (watchingCameraId() === response.cameraId) {
        await stopWatchingCamera(true);
      }
    } catch (error) {
      terminalActions.addLine(`Cannot remove camera: ${String(error)}`, 'error');
    }
  };

  const closePanel = () => {
    void stopWatchingCamera(true);
    terminalActions.setActiveModal(null);
  };

  const loadDispatchSettings = async () => {
    try {
      const response = await fetchNui<unknown>('cad:getDispatchSettings', {});
      setDispatchSettings(normalizeDispatchSettings(response));
    } catch (error) {
      terminalActions.addLine(`Failed loading dispatch settings, using defaults: ${String(error)}`, 'error');
      setDispatchSettings(DEFAULT_DISPATCH_SETTINGS);
    }
  };

  const assignUnitToCall = async (unitId: string, callId: string) => {
    try {
      const result = await fetchNui<DispatchCall | DispatchGuardError | null>('cad:assignUnitToCall', {
        unitId,
        callId,
      });

      if (isGuardError(result)) {
        terminalActions.addLine(`Assignment blocked: ${result.error}`, 'error');
        return;
      }

      if (!isDispatchCall(result)) {
        terminalActions.addLine('Assignment failed: invalid response', 'error');
        return;
      }

      cadActions.updateDispatchCall(callId, result);
      cadActions.updateDispatchUnit(unitId, {
        status: 'BUSY',
        currentCall: callId,
      });
      terminalActions.addLine(`Unit ${unitId} assigned to ${callId}`, 'output');
      notifyCallToChannels(result, [unitId], 'Assignment');
    } catch (error) {
      terminalActions.addLine(`Failed assigning unit: ${String(error)}`, 'error');
    }
  };

  const unassignUnit = async (unitId: string, callId?: string) => {
    const resolvedCallId = callId || cadState.dispatchUnits[unitId]?.currentCall;
    if (!resolvedCallId) {
      return;
    }

    try {
      const result = await fetchNui<DispatchCall | DispatchGuardError | null>('cad:unassignUnitFromCall', {
        unitId,
        callId: resolvedCallId,
      });

      if (isGuardError(result)) {
        terminalActions.addLine(`Unassign blocked: ${result.error}`, 'error');
        return;
      }

      if (!isDispatchCall(result)) {
        terminalActions.addLine('Unassign failed: invalid response', 'error');
        return;
      }

      cadActions.updateDispatchCall(resolvedCallId, result);
      cadActions.updateDispatchUnit(unitId, {
        status: 'AVAILABLE',
        currentCall: undefined,
      });
      terminalActions.addLine(`Unit ${unitId} released from ${resolvedCallId}`, 'output');
    } catch (error) {
      terminalActions.addLine(`Failed unassigning unit: ${String(error)}`, 'error');
    }
  };

  const closeCall = async (callId: string) => {
    try {
      const result = await fetchNui<DispatchCall | DispatchGuardError | null>('cad:closeDispatchCall', {
        callId,
        resolution: 'Closed by dispatcher',
      });

      if (isGuardError(result)) {
        terminalActions.addLine(`Close call blocked: ${result.error}`, 'error');
        return;
      }

      if (!isDispatchCall(result)) {
        terminalActions.addLine('Close call failed: invalid response', 'error');
        return;
      }

      cadActions.updateDispatchCall(callId, result);

      Object.keys(result.assignedUnits).forEach((unitId) => {
        cadActions.updateDispatchUnit(unitId, {
          status: 'AVAILABLE',
          currentCall: undefined,
        });
      });

      terminalActions.addLine(`Call ${callId} closed`, 'system');
    } catch (error) {
      terminalActions.addLine(`Failed closing call: ${String(error)}`, 'error');
    }
  };

  const autoAssignBestUnit = async () => {
   const call = selectedCall();
    const suggestion = recommendedUnit();

    if (!call || call.status === 'CLOSED') {
      terminalActions.addLine('Cannot auto-assign: call is closed or missing', 'error');
      return;
    }

    if (!suggestion) {
      terminalActions.addLine('No available unit for auto-assignment', 'error');
      return;
    }

    await assignUnitToCall(suggestion.unit.unitId, call.callId);
  };

  const createCaseFromCall = (callId: string) => {
    const call = cadState.dispatchCalls[callId];
    if (!call) {
      return;
    }

    const linkedCase = Object.values(cadState.cases).find((caseItem) => caseItem.linkedCallId === call.callId);
    if (linkedCase) {
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

  const submitNewCall = async () => {
    const payload = callForm();
    if (payload.title.trim().length < 3) {
      terminalActions.addLine('Call title must have at least 3 characters', 'error');
      return;
    }

    setCreatingCall(true);
    try {
      const result = await fetchNui<DispatchCall | DispatchGuardError | null>('cad:createDispatchCall', {
        title: payload.title,
        type: payload.type,
        priority: Number(payload.priority),
        location: payload.location,
        description: payload.description,
      });

      if (isGuardError(result)) {
        terminalActions.addLine(`Create call blocked: ${result.error}`, 'error');
        return;
      }

      if (!isDispatchCall(result)) {
        terminalActions.addLine('Create call failed: invalid response', 'error');
        return;
      }

      cadActions.addDispatchCall(result);
      setSelectedCallId(result.callId);
      setCallForm({
        title: '',
        type: payload.type,
        priority: payload.priority,
        location: '',
        description: '',
      });
      terminalActions.addLine(`Dispatch call ${result.callId} created`, 'output');
      radioActions.injectSystemMessage('CH-1', `New call ${result.callId}: ${result.title}`, 'TEXT', 'DISPATCH', 'DSP');
    } catch (error) {
      terminalActions.addLine(`Failed creating call: ${String(error)}`, 'error');
    } finally {
      setCreatingCall(false);
    }
  };

  createEffect(() => {
    void loadDispatchSettings();
  });

  createEffect(() => {
    const options = callTypeOptions();
    const currentType = callForm().type;
    if (options.length > 0 && !options.includes(currentType)) {
      setCallForm((prev) => ({ ...prev, type: options[0] }));
    }
  });

  createEffect(() => {
    const selected = selectedCall();
    if (!selected) {
      setSelectedCallId(null);
      return;
    }

    if (selectedCallId() !== selected.callId) {
      setSelectedCallId(selected.callId);
    }
  });

  createEffect(() => {
    const cameraId = watchingCameraId();
    if (!cameraId) {
      return;
    }

    const camera = cadState.securityCameras[cameraId];
    if (!camera || camera.status !== 'ACTIVE') {
      void stopWatchingCamera(true);
    }
  });

  onMount(() => {
    void refreshCameraGrid(true);
  });

  onCleanup(() => {
    void stopWatchingCamera(true);
  });

  createEffect(() => {
    const settings = dispatchSettings();
    // Solo reloj local para timestamps.
    const clockInterval = window.setInterval(() => {
      setNowMs(Date.now());
    }, settings.clockTickMs);

    onCleanup(() => {
      window.clearInterval(clockInterval);
    });
  });

  return (
        <Modal.Root onClose={closePanel} useContentWrapper={false}>
      <div class="modal-content dispatch-table-modal dispatch-v2-modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header dispatch-v2-header">
          <h2>=== DISPATCH OPERATIONS CENTER ===</h2>
          <div class="dispatch-v2-header-actions">
            <Button.Root class="btn" onClick={() => terminalActions.setActiveModal('MAP', { returnModal: 'DISPATCH_PANEL' })}>[MAP]</Button.Root>
            <button class="modal-close" onClick={closePanel}>[X]</button>
          </div>
        </div>

        <Show when={watchingCameraId()}>
          <div class="dispatch-cctv-crt-overlay">
            <div
              class="dispatch-cctv-mock-feed"
              style={{
                'background-image': `url(${getMockCameraBackground(activeWatchedCamera())})`,
              }}
            />
            <div class="dispatch-cctv-crt-scanlines" />
            <div class="dispatch-cctv-crt-label">CCTV LIVE FEED</div>
            <Show when={activeWatchedCamera()}>
              {(cameraAccessor) => {
                const camera = cameraAccessor();
                return (
                  <div class="dispatch-cctv-crt-meta">
                     CAM #{formatCameraNumber(camera.cameraNumber)} | {camera.street || 'Street unavailable'}
                  </div>
                );
              }}
            </Show>
          </div>
        </Show>

        <div class="dispatch-v2-kpis">
          <div class="dispatch-v2-kpi pending">
            <span>Pending Calls</span>
            <strong>{metrics().pending}</strong>
          </div>
          <div class="dispatch-v2-kpi active">
            <span>Active Calls</span>
            <strong>{metrics().active}</strong>
          </div>
          <div class="dispatch-v2-kpi available">
            <span>Units Available</span>
            <strong>{metrics().available}</strong>
          </div>
          <div class="dispatch-v2-kpi busy">
            <span>Units Busy</span>
            <strong>{metrics().busy}</strong>
          </div>
        </div>

        <div class="dispatch-v2-filters">
          <input
            class="input"
            type="text"
            placeholder="Search by call id, title, location, code"
            value={searchQuery()}
            onInput={(event) => setSearchQuery(event.currentTarget.value)}
          />
          <select class="input" value={statusFilter()} onChange={(event) => setStatusFilter(event.currentTarget.value as 'ALL' | 'PENDING' | 'ACTIVE' | 'CLOSED')}>
            <option value="ALL">ALL STATUS</option>
            <option value="PENDING">PENDING</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="CLOSED">CLOSED</option>
          </select>
          <select class="input" value={priorityFilter()} onChange={(event) => setPriorityFilter(event.currentTarget.value as 'ALL' | '1' | '2' | '3')}>
            <option value="ALL">ALL PRIORITY</option>
            <option value="1">HIGH</option>
            <option value="2">MEDIUM</option>
            <option value="3">LOW</option>
          </select>
          <select class="input" value={unitTypeFilter()} onChange={(event) => setUnitTypeFilter(event.currentTarget.value as 'ALL' | 'PATROL' | 'EMS' | 'SUPERVISOR')}>
            <option value="ALL">ALL UNIT TYPES</option>
            <option value="PATROL">PATROL</option>
            <option value="EMS">EMS</option>
            <option value="SUPERVISOR">SUPERVISOR</option>
          </select>
        </div>

        <div class="case-modal-hint" style={{ 'margin-bottom': '12px' }}>
          Queue on the left, incident workspace in the center, unit board on the right.
        </div>

        <div class="dispatch-v2-layout">
          <section class="dispatch-v2-column dispatch-v2-queue">
            <div class="dispatch-v2-section-title">CALL QUEUE ({visibleCalls().length})</div>
            <Show when={visibleCalls().length > 0}>
              <div class="case-modal-hint">Click a call to load unit assignment, case actions, and CCTV.</div>
            </Show>
            <div class="dispatch-v2-call-list">
              <For each={visibleCalls()}>
                {(call) => (
                  <DispatchCallCard
                    call={call}
                    selected={isCallSelected(call.callId)}
                    onSelect={setSelectedCallId}
                    getSlaLevel={getCallSlaLevelFor}
                    getSlaLabel={getCallSlaLabelFor}
                    formatAge={formatAge}
                    priorityLabel={priorityLabel}
                  />
                )}
              </For>
              <Show when={visibleCalls().length === 0}>
                <div class="empty-state">No dispatch calls match the current filters</div>
              </Show>
            </div>
          </section>

          <section class="dispatch-v2-column dispatch-v2-workspace">
            <Show
              when={selectedCall()}
              fallback={
                <>
                  <div class="empty-state">Select a dispatch call to open the incident workspace</div>
                  <div class="dispatch-v2-section-title">CCTV GRID ({cameraGrid().length})</div>
                  <DispatchCCTVGrid
                    cameras={cameraGrid()}
                    cameraLoading={cameraLoading()}
                    watchingCameraId={watchingCameraId()}
                    formatCameraNumber={formatCameraNumber}
                    onRefresh={() => void refreshCameraGrid()}
                    onStopView={() => void stopWatchingCamera()}
                    onWatch={(cameraId) => void watchCamera(cameraId)}
                    onToggleStatus={(cameraId, status) => void setCameraStatus(cameraId, status)}
                    onRemove={(camera) => void removeCamera(camera)}
                  />
                </>
              }
            >
              {(callAccessor) => {
                const call = callAccessor();
                return (
                  <>
                    <div class="dispatch-v2-section-title">INCIDENT WORKSPACE</div>
                    <div class={`dispatch-v2-incident-card sla-${getCallSlaLevelFor(call)}`}>
                      <div class="dispatch-v2-incident-top">
                        <div>
                          <strong>{call.callId}</strong> - {call.title}
                        </div>
                        <span class={`dispatch-v2-priority priority-${priorityLabel(call.priority).toLowerCase()}`}>
                          {priorityLabel(call.priority)}
                        </span>
                      </div>
                      <div class="dispatch-v2-incident-row">
                        <span>Type: {call.type}</span>
                        <span>Status: {call.status}</span>
                        <span>Opened: {formatAge(call.createdAt)} ago</span>
                      </div>
                      <div class="dispatch-v2-incident-row">
                        <span class={`dispatch-v2-sla-badge sla-${getCallSlaLevelFor(call)}`}>
                          {getCallSlaLabelFor(call)}
                        </span>
                      </div>
                      <div class="dispatch-v2-incident-row">
                        <span>Location: {call.location || 'Location unavailable'}</span>
                      </div>
                      <div class="summary-stats" style={{ 'margin-top': '12px' }}>
                        <div class="stat-box case">
                          <div class="stat-number">{selectedCallSummary()?.assigned || 0}</div>
                          <div class="stat-label">Assigned</div>
                        </div>
                        <div class="stat-box vehicle">
                          <div class="stat-number">{selectedCallSummary()?.availableMatches || 0}</div>
                          <div class="stat-label">Available Units</div>
                        </div>
                        <div class="stat-box record">
                          <div class="stat-number">{selectedCallSummary()?.hasLinkedCase ? 'YES' : 'NO'}</div>
                          <div class="stat-label">Linked Case</div>
                        </div>
                      </div>
                      <Show when={call.description?.trim()}>
                        <div class="dispatch-v2-call-description">{call.description}</div>
                      </Show>
                      <div class="dispatch-v2-incident-actions">
                        <Button.Root class="btn" onClick={() => createCaseFromCall(call.callId)}>
                          [{getCaseActionLabel(call.callId)}]
                        </Button.Root>
                        <Show when={Object.keys(call.assignedUnits).length > 0}>
                          <Button.Root
                            class="btn"
                            onClick={() => notifyCallToChannels(call, Object.keys(call.assignedUnits), 'Case update')}
                          >
                            [NOTIFY UNITS]
                          </Button.Root>
                        </Show>
                        <Button.Root
                          class="btn"
                          onClick={() => {
                            newsActions.prefillFromDispatch({
                              title: call.title,
                              description: call.description,
                              type: call.type,
                            });
                            terminalActions.setActiveModal('NEWS_MANAGER');
                          }}
                        >
                          [PUBLISH NEWS]
                        </Button.Root>
                        <Show when={call.status !== 'CLOSED'}>
                          <Button.Root class="btn btn-danger" onClick={() => void closeCall(call.callId)}>
                            [CLOSE CALL]
                          </Button.Root>
                        </Show>
                      </div>
                    </div>

                    <div class="dispatch-v2-section-title">ASSIGNED UNITS ({selectedCallAssignedUnits().length})</div>
                    <div class="dispatch-v2-assigned-list">
                      <For each={selectedCallAssignedUnits()}>
                        {(unit) => (
                          <DispatchUnitActionRow
                            unit={unit}
                            subtitle={`${unit.type} - ${unit.status}`}
                            actionLabel="RELEASE"
                            actionClass="btn btn-warning"
                            onAction={() => void unassignUnit(unit.unitId, call.callId)}
                          />
                        )}
                      </For>
                      <Show when={selectedCallAssignedUnits().length === 0}>
                        <div class="empty-state">No units currently assigned to this call</div>
                      </Show>
                    </div>

                    <div class="dispatch-v2-section-title">AVAILABLE UNITS ({availableUnits().length})</div>
                    <Show when={recommendedUnit()}>
                      {(suggestionAccessor) => {
                        const suggestion = suggestionAccessor();
                        return (
                          <div class="dispatch-v2-recommendation">
                            <div>
                              Suggested: <strong>{suggestion.unit.unitId}</strong> ({suggestion.unit.type}) - {suggestion.reason}
                              <Show when={suggestion.distance > 0}>
                                <span> [{Math.floor(suggestion.distance)}m]</span>
                              </Show>
                            </div>
                            <Button.Root class="btn btn-primary" onClick={() => void autoAssignBestUnit()} disabled={call.status === 'CLOSED'}>
                              [AUTO ASSIGN BEST]
                            </Button.Root>
                          </div>
                        );
                      }}
                    </Show>
                    <div class="dispatch-v2-available-list">
                      <For each={availableUnits()}>
                        {(unit) => (
                          <DispatchUnitActionRow
                            unit={unit}
                            subtitle={`${unit.type}`}
                            actionLabel="ASSIGN"
                            actionClass="btn btn-primary"
                            actionDisabled={call.status === 'CLOSED'}
                            onAction={() => void assignUnitToCall(unit.unitId, call.callId)}
                          />
                        )}
                      </For>
                      <Show when={availableUnits().length === 0}>
                        <div class="empty-state">No available units match the current type filter</div>
                      </Show>
                    </div>

                    <div class="dispatch-v2-section-title">CCTV GRID ({cameraGrid().length})</div>
                    <DispatchCCTVGrid
                      cameras={cameraGrid()}
                      cameraLoading={cameraLoading()}
                      watchingCameraId={watchingCameraId()}
                      formatCameraNumber={formatCameraNumber}
                      onRefresh={() => void refreshCameraGrid()}
                      onStopView={() => void stopWatchingCamera()}
                      onWatch={(cameraId) => void watchCamera(cameraId)}
                      onToggleStatus={(cameraId, status) => void setCameraStatus(cameraId, status)}
                      onRemove={(camera) => void removeCamera(camera)}
                    />
                  </>
                );
              }}
            </Show>
          </section>

          <section class="dispatch-v2-column dispatch-v2-units">
            <div class="dispatch-v2-section-title">UNIT BOARD ({allUnits().length})</div>
            <div class="summary-stats" style={{ 'margin-bottom': '12px' }}>
              <div class="stat-box vehicle">
                <div class="stat-number">{unitBoardSummary().available}</div>
                <div class="stat-label">Available</div>
              </div>
              <div class="stat-box warrant">
                <div class="stat-number">{unitBoardSummary().busy}</div>
                <div class="stat-label">Busy</div>
              </div>
              <div class="stat-box case">
                <div class="stat-number">{unitBoardSummary().enroute}</div>
                <div class="stat-label">Enroute</div>
              </div>
            </div>
            <div class="dispatch-v2-unit-board">
              <For each={allUnits()}>
                {(unit) => (
                  <div class="dispatch-v2-unit-board-row">
                    <div class="dispatch-v2-unit-main">
                      <div>
                        <strong>{unit.unitId}</strong> {unit.name}
                      </div>
                      <div class="dispatch-v2-unit-sub">{unit.type} | Badge {unit.badge}</div>
                    </div>
                    <div class="dispatch-v2-unit-right">
                      <span class={`dispatch-v2-status status-${unit.status.toLowerCase()}`}>{unit.status}</span>
                      <Show when={unit.currentCall}>
                        <span class="dispatch-v2-current-call">{unit.currentCall}</span>
                      </Show>
                      <Show when={unit.status === 'BUSY' && unit.currentCall}>
                        <Button.Root class="btn btn-warning" onClick={() => void unassignUnit(unit.unitId, unit.currentCall)}>
                          [RELEASE]
                        </Button.Root>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
              <Show when={allUnits().length === 0}>
                <div class="empty-state">No dispatch units are connected right now</div>
              </Show>
            </div>
          </section>
        </div>

        <div class="dispatch-v2-composer">
          <div class="dispatch-v2-section-title">CREATE INCIDENT</div>
          <div class="case-modal-hint" style={{ 'margin-bottom': '10px' }}>
            Use quick create for new 911 or officer-initiated incidents without leaving dispatch.
          </div>
          <div class="dispatch-v2-composer-grid">
            <input
              class="input"
              type="text"
              placeholder="Call title"
              value={callForm().title}
              onInput={(event) => setCallForm((prev) => ({ ...prev, title: event.currentTarget.value }))}
            />
            <input
              class="input"
              type="text"
              placeholder="Location"
              value={callForm().location}
              onInput={(event) => setCallForm((prev) => ({ ...prev, location: event.currentTarget.value }))}
            />
            <select
              class="input"
              value={callForm().type}
              onChange={(event) => setCallForm((prev) => ({ ...prev, type: event.currentTarget.value }))}
            >
              <For each={callTypeOptions()}>
                {(typeOption) => (
                  <option value={typeOption}>{typeOption}</option>
                )}
              </For>
            </select>
            <select
              class="input"
              value={callForm().priority}
              onChange={(event) => setCallForm((prev) => ({ ...prev, priority: event.currentTarget.value }))}
            >
              <option value="1">HIGH</option>
              <option value="2">MEDIUM</option>
              <option value="3">LOW</option>
            </select>
            <input
              class="input dispatch-v2-composer-description"
              type="text"
              placeholder="Short description"
              value={callForm().description}
              onInput={(event) => setCallForm((prev) => ({ ...prev, description: event.currentTarget.value }))}
            />
            <Button.Root class="btn btn-primary" onClick={() => void submitNewCall()} disabled={creatingCall()}>
              [{creatingCall() ? 'CREATING...' : 'CREATE CALL'}]
            </Button.Root>
          </div>
        </div>

        <div class="modal-footer">
          <span style={{ color: '#808080', 'font-size': '14px' }}>
            Profile {dispatchSettings().profileName.toUpperCase()} | Live sync every {Math.round(dispatchSettings().refreshIntervalMs / 1000)}s | Calls {allCalls().length} | Units {allUnits().length}
          </span>
          <Button.Root class="btn" onClick={closePanel}>[CLOSE]</Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
