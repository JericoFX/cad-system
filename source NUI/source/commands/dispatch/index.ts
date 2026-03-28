
import { createCommandWithSubcommands } from '../commandBuilder';
import { cadActions, cadState, type DispatchUnit, type DispatchCall } from '~/stores/cadStore';

const mockUnits: DispatchUnit[] = [
  { unitId: '1A-01', badge: '101', name: 'Officer Smith', status: 'AVAILABLE', type: 'PATROL' },
  { unitId: '1A-02', badge: '102', name: 'Officer Johnson', status: 'BUSY', type: 'PATROL', currentCall: 'CALL_001' },
  { unitId: '1B-01', badge: '201', name: 'Sgt. Williams', status: 'AVAILABLE', type: 'SUPERVISOR' },
  { unitId: 'EMS-01', badge: 'E01', name: 'Medic Brown', status: 'AVAILABLE', type: 'EMS' },
  { unitId: 'EMS-02', badge: 'E02', name: 'Paramedic Davis', status: 'BUSY', type: 'EMS', currentCall: 'CALL_002' }
];

const mockCalls: DispatchCall[] = [
  {
    callId: 'CALL_001',
    type: '10-31',
    priority: 2,
    title: 'Suspicious Activity',
    description: 'Reports of suspicious individuals near convenience store',
    location: '123 Main St',
    status: 'ACTIVE',
    assignedUnits: { '1A-02': { assignedAt: new Date().toISOString() } },
    createdAt: new Date().toISOString()
  },
  {
    callId: 'CALL_002',
    type: '10-50',
    priority: 1,
    title: 'Traffic Accident',
    description: 'Two vehicle collision with injuries',
    location: 'Highway 13 Mile 5',
    status: 'ACTIVE',
    assignedUnits: { 'EMS-02': { assignedAt: new Date().toISOString() } },
    createdAt: new Date().toISOString()
  },
  {
    callId: 'CALL_003',
    type: '10-71',
    priority: 3,
    title: 'Noise Complaint',
    description: 'Loud music from residence',
    location: '456 Oak Ave',
    status: 'PENDING',
    assignedUnits: {},
    createdAt: new Date().toISOString()
  }
];

export function registerDispatchCommands(): void {
  createCommandWithSubcommands({
    name: 'dispatch',
    description: 'Dispatch system - GUI map or CLI mode',
    usage: 'dispatch <gui|units|calls|assign|emergency>',
    category: 'DISPATCH',
    permissions: ['police', 'ems', 'dispatch'],
    subcommands: {
      gui: {
        description: 'Open dispatch map GUI',
        handler: async ({ terminal }) => {
          terminal.openModal('MAP');
          terminal.print('Opening tactical dispatch map...', 'system');
        }
      },
      cctv: {
        description: 'Open security camera panel',
        handler: async ({ terminal }) => {
          terminal.openModal('SECURITY_CAMERA_PANEL');
          terminal.print('Opening security camera panel...', 'system');
        }
      },
      view: {
        description: 'Open dispatch panel (alias for gui)',
        handler: async ({ terminal }) => {
          terminal.openModal('DISPATCH_PANEL');
          terminal.print('Opening dispatch control panel...', 'system');
        }
      },
      units: {
        description: 'List units (CLI mode)',
        handler: async ({ args, terminal }) => {
          const filter = (args.filter as string)?.toUpperCase();
          
          const allUnits = [...mockUnits, ...(Object.values(cadState.dispatchUnits) as DispatchUnit[])];
          let units = allUnits;
          
          if (filter) {
            units = allUnits.filter(u => 
              u.unitId.toUpperCase().includes(filter) ||
              u.status.toUpperCase().includes(filter) ||
              u.type.toUpperCase().includes(filter)
            );
          }
          
          terminal.print('\n=== DISPATCH UNITS ===', 'system');
          
          if (units.length === 0) {
            terminal.print('No units found', 'error');
            return;
          }
          
          const headers = ['UNIT', 'BADGE', 'NAME', 'TYPE', 'STATUS', 'CALL'];
          const rows = units.map(u => [
            u.unitId,
            u.badge,
            u.name.substring(0, 15),
            u.type,
            u.status,
            u.currentCall || '-'
          ]);
          
          terminal.printTable(headers, rows);
          terminal.print(`\nTotal: ${units.length} units`, 'info');
        }
      },
      calls: {
        description: 'List calls (CLI mode)',
        handler: async ({ args, terminal }) => {
          const filter = (args.filter as string)?.toUpperCase();
          
          const allCalls = [...mockCalls, ...(Object.values(cadState.dispatchCalls) as DispatchCall[])];
          let calls = allCalls;
          
          if (filter) {
            calls = allCalls.filter(c => 
              c.callId.toUpperCase().includes(filter) ||
              c.status.toUpperCase().includes(filter) ||
              c.type.toUpperCase().includes(filter)
            );
          }
          
          calls = calls.sort((a, b) => a.priority - b.priority);
          
          terminal.print('\n=== DISPATCH CALLS ===', 'system');
          
          if (calls.length === 0) {
            terminal.print('No calls found', 'info');
            return;
          }
          
          calls.forEach(call => {
            const priorityColor = call.priority === 1 ? 'error' : call.priority === 2 ? 'warning' : 'info';
            const assignedCount = Object.keys(call.assignedUnits).length;
            
            terminal.print(`\n[${call.callId}] ${call.type} - Priority ${call.priority}`, priorityColor);
            terminal.print(`  Title: ${call.title}`, 'info');
            terminal.print(`  Location: ${call.location || 'N/A'}`, 'info');
            terminal.print(`  Status: ${call.status} | Units: ${assignedCount}`, 'info');
            
            if (call.description) {
              terminal.print(`  ${call.description.substring(0, 50)}${call.description.length > 50 ? '...' : ''}`, 'info');
            }
          });
          
          terminal.print(`\nTotal: ${calls.length} calls`, 'info');
        }
      },
      assign: {
        description: 'Assign unit to call (CLI mode)',
        handler: async ({ args, terminal }) => {
          let unitId = args.unitId as string;
          let callId = args.callId as string;
          
          const allUnits = [...mockUnits, ...(Object.values(cadState.dispatchUnits) as DispatchUnit[])];
          const availableUnits = allUnits.filter(u => u.status === 'AVAILABLE');
          
          if (!unitId) {
            if (availableUnits.length === 0) {
              terminal.print('No available units', 'error');
              return;
            }
            
            const unitOptions = availableUnits.map(u => `${u.unitId} - ${u.name} (${u.type})`);
            const selected = await terminal.select('Select unit to assign:', unitOptions);
            unitId = selected.split(' - ')[0];
          }
          
          const allCalls = [...mockCalls, ...(Object.values(cadState.dispatchCalls) as DispatchCall[])];
          const activeCalls = allCalls.filter(c => c.status === 'PENDING' || c.status === 'ACTIVE');
          
          if (!callId) {
            if (activeCalls.length === 0) {
              terminal.print('No active calls', 'error');
              return;
            }
            
            const callOptions = activeCalls.map(c => `${c.callId} - ${c.title} [${c.type}]`);
            const selected = await terminal.select('Select call:', callOptions);
            callId = selected.split(' - ')[0];
          }
          
          const unit = allUnits.find(u => u.unitId === unitId);
          const call = allCalls.find(c => c.callId === callId);
          
          if (!unit) {
            terminal.print(`Unit not found: ${unitId}`, 'error');
            return;
          }
          
          if (!call) {
            terminal.print(`Call not found: ${callId}`, 'error');
            return;
          }
          
          if (unit.status === 'BUSY' && unit.currentCall) {
            const reassign = await terminal.confirm(`Unit ${unitId} is on another call. Reassign?`);
            if (!reassign) {
              terminal.print('Assignment cancelled', 'warning');
              return;
            }
          }
          
          cadActions.updateDispatchUnit(unitId, {
            status: 'BUSY',
            currentCall: callId
          });
          
          const updatedAssignedUnits = {
            ...call.assignedUnits,
            [unitId]: { assignedAt: new Date().toISOString() }
          };
          
          cadActions.updateDispatchCall(callId, {
            status: 'ACTIVE',
            assignedUnits: updatedAssignedUnits
          });
          
          terminal.print(`\n✓ Unit ${unitId} assigned to ${callId}`, 'success');
          terminal.print(`${unit.name} is responding to: ${call.title}`, 'info');
        }
      },
      emergency: {
        description: 'Create emergency dispatch call',
        handler: async ({ args, terminal }) => {
          let type = args.type as string;
          
          if (!type) {
            type = await terminal.select('Select emergency type:', [
              'Officer Down (10-999)',
              'Officer Needs Help (10-33)',
              'Shots Fired (10-71)',
              'Vehicle Pursuit (10-80)',
              'Officer Involved Accident',
              'Medical Emergency',
              'Other Emergency'
            ]);
          }
          
          const codeMatch = type.match(/\((10-\d+)\)/);
          const code = codeMatch ? codeMatch[1] : 'EMERGENCY';
          
          const location = await terminal.prompt('Enter location:');
          const description = await terminal.prompt('Enter description:');
          
          terminal.print('\n=== EMERGENCY CALL ===', 'error');
          terminal.print(`Type: ${code}`, 'error');
          terminal.print(`Location: ${location || 'N/A'}`, 'info');
          terminal.print(`Description: ${description || 'N/A'}`, 'info');
          
          const confirmed = await terminal.confirm('Create emergency call?');
          
          if (!confirmed) {
            terminal.print('Emergency call cancelled', 'warning');
            return;
          }
          
          const stopLoading = terminal.showLoading('Dispatching emergency');
          
          try {
            const callId = `EMRG_${Date.now()}`;
            
            const emergencyCall: DispatchCall = {
              callId,
              type: code,
              priority: 1,
              title: type.split('(')[0].trim(),
              description: description || 'Emergency call',
              location: location || 'Unknown',
              status: 'PENDING',
              assignedUnits: {},
              createdAt: new Date().toISOString()
            };
            
            cadActions.addDispatchCall(emergencyCall);
            
            stopLoading();
            
            terminal.print(`\n🚨 EMERGENCY CALL CREATED 🚨`, 'error');
            terminal.print(`Call ID: ${callId}`, 'error');
            terminal.print(`All available units notified`, 'warning');
            
            const availableUnits = (Object.values(cadState.dispatchUnits) as DispatchUnit[])
              .filter(u => u.status === 'AVAILABLE');
            
            if (availableUnits.length > 0) {
              terminal.print(`\nAuto-assigning ${availableUnits.length} available unit(s)...`, 'info');
              
              availableUnits.forEach(unit => {
                cadActions.updateDispatchUnit(unit.unitId, {
                  status: 'BUSY',
                  currentCall: callId
                });
              });
              
              cadActions.updateDispatchCall(callId, {
                status: 'ACTIVE',
                assignedUnits: availableUnits.reduce((acc, u) => {
                  acc[u.unitId] = { assignedAt: new Date().toISOString() };
                  return acc;
                }, {} as Record<string, { assignedAt: string }>)
              });
            }
            
          } catch (error) {
            stopLoading();
            terminal.print(`Failed to create emergency: ${error}`, 'error');
          }
        }
      }
    },
    defaultSubcommand: 'gui'
  });
}

export { registerDispatchCommands as default };
