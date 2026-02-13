import { createMemo } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { cadState, cadActions } from '~/stores/cadStore';
import { fetchNui } from '~/utils/fetchNui';
import { Kanban } from '../Kanban';
import type { KanbanColumn, KanbanItem } from '../Kanban.types';
import type { DispatchUnit, DispatchCall } from '~/stores/cadStore';

export function DispatchPanel() {
  const availableUnits = createMemo(() => 
    Object.values(cadState.dispatchUnits).filter(u => u.status === 'AVAILABLE')
  );
  
  const busyUnits = createMemo(() => 
    Object.values(cadState.dispatchUnits).filter(u => u.status === 'BUSY')
  );
  
  const pendingCalls = createMemo(() => 
    Object.values(cadState.dispatchCalls).filter(c => c.status === 'PENDING')
  );
  
  const activeCalls = createMemo(() => 
    Object.values(cadState.dispatchCalls).filter(c => c.status === 'ACTIVE')
  );
  
  const kanbanItems = createMemo<KanbanItem[]>(() => {
    const items: KanbanItem[] = [];
    
    availableUnits().forEach((unit, idx) => {
      items.push({
        id: `unit-${unit.unitId}`,
        columnId: 'available',
        priority: idx,
        content: (
          <div>
            <div style={{ "font-weight": 'bold', color: '#ffffff' }}>{unit.unitId}</div>
            <div style={{ "font-size": '14px', color: '#c0c0c0' }}>{unit.name}</div>
            <div style={{ "font-size": '12px', color: '#808080' }}>Badge: {unit.badge}</div>
            <div style={{ "font-size": '12px', color: '#00ff00', 'text-transform': 'uppercase' }}>[{unit.type}]</div>
          </div>
        )
      });
    });
    
    busyUnits().forEach((unit, idx) => {
      items.push({
        id: `unit-${unit.unitId}`,
        columnId: 'busy',
        priority: idx,
        content: (
          <div>
            <div style={{ "font-weight": 'bold', color: '#ffffff' }}>{unit.unitId}</div>
            <div style={{ "font-size": '14px', color: '#c0c0c0' }}>{unit.name}</div>
            <div style={{ "font-size": '12px', color: '#ff0000' }}>Call: {unit.currentCall}</div>
          </div>
        )
      });
    });
    
    pendingCalls().forEach((call) => {
      const priorityColor = call.priority === 1 ? '#ff0000' : call.priority === 2 ? '#ffff00' : '#00ff00';
      const priorityLabel = call.priority === 1 ? 'HIGH' : call.priority === 2 ? 'MED' : 'LOW';
      
      items.push({
        id: `call-${call.callId}`,
        columnId: 'pending',
        priority: call.priority,
        content: (
          <div>
            <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
              <span style={{ color: priorityColor, 'font-weight': 'bold', 'font-size': '12px' }}>[{priorityLabel}]</span>
              <span style={{ "font-size": '11px', color: '#808080' }}>{call.callId}</span>
            </div>
            <div style={{ "font-weight": 'bold', color: '#ffffff', 'margin-top': '4px' }}>{call.title}</div>
            {call.location && (
              <div style={{ "font-size": '12px', color: '#808080', 'margin-top': '2px' }}>LOC: {call.location}</div>
            )}
            <div style={{ "font-size": '11px', color: '#ffff00', 'margin-top': '4px' }}>Drag unit here to assign</div>
          </div>
        )
      });
    });
    
    activeCalls().forEach((call) => {
      const unitCount = Object.keys(call.assignedUnits).length;
      const priorityColor = call.priority === 1 ? '#ff0000' : call.priority === 2 ? '#ffff00' : '#00ff00';
      const priorityLabel = call.priority === 1 ? 'HIGH' : call.priority === 2 ? 'MED' : 'LOW';
      
      items.push({
        id: `call-${call.callId}`,
        columnId: 'active',
        priority: call.priority,
        content: (
          <div>
            <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
              <span style={{ color: priorityColor, 'font-weight': 'bold', 'font-size': '12px' }}>[{priorityLabel}]</span>
              <span style={{ "font-size": '11px', color: '#808080' }}>{unitCount} units</span>
            </div>
            <div style={{ "font-weight": 'bold', color: '#ffffff', 'margin-top': '4px' }}>{call.title}</div>
            <div style={{ "font-size": '12px', color: '#00ff00', 'margin-top': '4px' }}>
              Units: {Object.keys(call.assignedUnits).join(', ') || 'None'}
            </div>
          </div>
        )
      });
    });
    
    return items;
  });
  
  const columns: KanbanColumn[] = [
    { id: 'available', title: 'AVAILABLE UNITS', color: 'priority-low' },
    { id: 'busy', title: 'BUSY UNITS', color: 'priority-high' },
    { id: 'pending', title: 'PENDING CALLS', color: 'priority-med' },
    { id: 'active', title: 'ACTIVE CALLS', color: 'priority-med' },
  ];
  
  const handleMove = (itemId: string, fromColumn: string, toColumn: string, newIndex: number) => {
    const [type, ...idParts] = itemId.split('-');
    const id = idParts.join('-');
    
    if (type === 'unit' && (toColumn === 'pending' || toColumn === 'active')) {
      const callItems = kanbanItems().filter((i: KanbanItem) => i.columnId === toColumn && i.id.startsWith('call-'));
      const targetCallItem = callItems[newIndex];
      
      if (targetCallItem) {
        const callId = targetCallItem.id.replace('call-', '');
        assignUnitToCall(id, callId);
      }
    }
    
    if (type === 'unit' && fromColumn === 'busy' && toColumn === 'available') {
      const unit = Object.values(cadState.dispatchUnits).find(u => u.unitId === id);
      if (unit?.currentCall) {
        unassignUnitFromCall(id, unit.currentCall);
      }
    }
  };
  
  const handleReorder = () => {
  };
  
  const assignUnitToCall = async (unitId: string, callId: string) => {
    try {
      const result = await fetchNui('cad:assignUnitToCall', { callId, unitId });
      if (result) {
        cadActions.updateDispatchCall(callId, result as DispatchCall);
        cadActions.updateDispatchUnit(unitId, { 
          status: 'BUSY', 
          currentCall: callId 
        });
        terminalActions.addLine(`Unit ${unitId} assigned to call ${callId}`, 'output');
      }
    } catch (error) {
      terminalActions.addLine(`Failed to assign unit: ${error}`, 'error');
    }
  };
  
  const unassignUnitFromCall = async (unitId: string, callId: string) => {
    try {
      const result = await fetchNui('cad:unassignUnitFromCall', { callId, unitId });
      if (result) {
        cadActions.updateDispatchCall(callId, result as DispatchCall);
        cadActions.updateDispatchUnit(unitId, { 
          status: 'AVAILABLE', 
          currentCall: undefined 
        });
        terminalActions.addLine(`Unit ${unitId} unassigned from call ${callId}`, 'output');
      }
    } catch (error) {
      terminalActions.addLine(`Failed to unassign unit: ${error}`, 'error');
    }
  };
  
  const closePanel = () => {
    terminalActions.setActiveModal(null);
  };
  
  const refreshData = async () => {
    try {
      const [units, calls] = await Promise.all([
        fetchNui('cad:getDispatchUnits', {}),
        fetchNui('cad:getDispatchCalls', {}),
      ]);
      cadActions.setDispatchUnits(units as Record<string, DispatchUnit>);
      cadActions.setDispatchCalls(calls as Record<string, DispatchCall>);
    } catch (error) {
      console.error('Failed to refresh dispatch data:', error);
    }
  };
  
  return (
    <div class="modal-overlay" onClick={closePanel}>
      <div class="modal-content dispatch-panel" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== DISPATCH CONTROL PANEL ===</h2>
          <button class="modal-close" onClick={closePanel}>[X]</button>
        </div>
        
        <div style={{ padding: '16px', "border-bottom": '2px solid var(--terminal-border)' }}>
          <div style={{ color: '#ffff00', "font-size": '14px', "margin-bottom": '8px' }}>
            [INSTRUCTIONS]
          </div>
          <div style={{ color: '#c0c0c0', "font-size": '14px' }}>
            Drag AVAILABLE UNITS to PENDING/ACTIVE CALLS to assign
          </div>
          <div style={{ color: '#c0c0c0', "font-size": '14px' }}>
            Drag BUSY UNITS to AVAILABLE to unassign
          </div>
        </div>
        
        <div style={{ padding: '16px' }}>
          <Kanban
            columns={columns}
            items={kanbanItems}
            columnWidth="280px"
            onMove={handleMove}
            onReorder={handleReorder}
          />
        </div>
        
        <div class="modal-footer">
          <button class="btn" onClick={refreshData}>[REFRESH]</button>
          <button class="btn" onClick={closePanel}>[CLOSE]</button>
        </div>
      </div>
    </div>
  );
}
