
import { createCommand } from '../commandBuilder';
import { cadActions, cadState, type Warrant } from '~/stores/cadStore';

export function registerWarrantCommand() {
  createCommand({
    name: 'warrant',
    description: 'Issue, search, and cancel arrest/search warrants',
    usage: 'warrant <issue|search|cancel|list>',
    category: 'POLICE',
    permissions: ['police'],
    args: [
      {
        name: 'action',
        type: 'string',
        required: false,
        description: 'Action: issue, search, cancel, list'
      }
    ],
    handler: async ({ args, terminal }) => {
      const action = (args.action as string)?.toLowerCase() || await terminal.select(
        'Select warrant action:',
        ['issue', 'search', 'cancel', 'list']
      );

      switch (action) {
        case 'issue':
          await handleIssueWarrant(terminal);
          break;
        case 'search':
          await handleSearchWarrants(terminal);
          break;
        case 'cancel':
          await handleCancelWarrant(terminal);
          break;
        case 'list':
          await handleListWarrants(terminal);
          break;
        default:
          terminal.print(`Unknown action: ${action}`, 'error');
          terminal.print('Usage: warrant <issue|search|cancel|list>', 'system');
      }
    }
  });
}

async function handleIssueWarrant(terminal: any) {
  const warrantType = await terminal.select(
    'Select warrant type:',
    ['ARREST', 'SEARCH']
  );

  const citizenId = await terminal.prompt('Enter Citizen ID:');
  if (!citizenId) {
    terminal.print('Warrant cancelled - no Citizen ID provided', 'error');
    return;
  }

  const personName = await terminal.prompt('Enter person name:');
  if (!personName) {
    terminal.print('Warrant cancelled - no name provided', 'error');
    return;
  }

  const reason = await terminal.prompt('Enter warrant reason:');
  if (!reason) {
    terminal.print('Warrant cancelled - no reason provided', 'error');
    return;
  }

  const expiresDays = await terminal.prompt('Expires in days (default 30):');
  const days = parseInt(expiresDays as string) || 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  terminal.print('\n=== WARRANT SUMMARY ===', 'system');
  terminal.print(`Type: ${warrantType}`, 'info');
  terminal.print(`Person: ${personName} (${citizenId})`, 'info');
  terminal.print(`Reason: ${reason}`, 'info');
  terminal.print(`Expires: ${expiresAt.toLocaleDateString()}`, 'info');

  const confirmed = await terminal.confirm('Issue warrant?');
  
  if (!confirmed) {
    terminal.print('Warrant cancelled', 'warning');
    return;
  }

  const stopLoading = terminal.showLoading('Issuing warrant');

  try {
    const warrantData = {
      warrantId: `WAR_${Date.now()}`,
      citizenid: citizenId,
      personName,
      type: warrantType as 'ARREST' | 'SEARCH',
      reason,
      issuedBy: 'OFFICER_001',
      issuedByName: 'Officer',
      issuedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      active: true,
      executed: false
    };

    cadActions.addWarrant(warrantData);
    stopLoading();
    
    terminal.print(`\n✓ Warrant issued: ${warrantData.warrantId}`, 'success');
    terminal.print(`Type: ${warrantType} | Person: ${personName}`, 'info');

  } catch (error) {
    stopLoading();
    terminal.print(`Failed to issue warrant: ${error}`, 'error');
  }
}

async function handleSearchWarrants(terminal: any) {
  const query = await terminal.prompt('Search by name or Citizen ID:');
  
  if (!query) {
    terminal.print('Search cancelled', 'warning');
    return;
  }

  const stopLoading = terminal.showLoading('Searching warrants');
  
  const lowerQuery = query.toLowerCase();
  const results = (Object.values(cadState.warrants) as Warrant[]).filter(w => 
    w.citizenid.toLowerCase().includes(lowerQuery) ||
    w.personName.toLowerCase().includes(lowerQuery)
  );

  stopLoading();

  if (results.length === 0) {
    terminal.print(`No warrants found for: ${query}`, 'error');
    return;
  }

  terminal.print(`\n=== WARRANT SEARCH RESULTS ===`, 'system');
  terminal.print(`Found ${results.length} warrant(s)`, 'info');

  const headers = ['ID', 'TYPE', 'NAME', 'REASON', 'STATUS', 'EXPIRES'];
  const rows = results.map(w => [
    w.warrantId.substring(0, 10),
    w.type,
    w.personName.substring(0, 15),
    w.reason.substring(0, 20),
    w.active ? (w.executed ? 'EXECUTED' : 'ACTIVE') : 'CANCELLED',
    w.expiresAt ? new Date(w.expiresAt).toLocaleDateString() : 'N/A'
  ]);

  terminal.printTable(headers, rows);
}

async function handleCancelWarrant(terminal: any) {
  const warrantId = await terminal.prompt('Enter warrant ID to cancel:');
  
  if (!warrantId) {
    terminal.print('Cancellation cancelled', 'warning');
    return;
  }

  const warrant = cadState.warrants[warrantId];
  
  if (!warrant) {
    terminal.print(`Warrant not found: ${warrantId}`, 'error');
    return;
  }

  if (!warrant.active) {
    terminal.print('Warrant is already inactive', 'warning');
    return;
  }

  const reason = await terminal.prompt('Cancellation reason:');

  terminal.print('\n=== CANCEL WARRANT ===', 'system');
  terminal.print(`ID: ${warrant.warrantId}`, 'info');
  terminal.print(`Person: ${warrant.personName}`, 'info');
  terminal.print(`Type: ${warrant.type}`, 'info');
  terminal.print(`Reason: ${reason || 'No reason provided'}`, 'info');

  const confirmed = await terminal.confirm('Cancel this warrant?');
  
  if (!confirmed) {
    terminal.print('Cancellation aborted', 'warning');
    return;
  }

  cadActions.updateWarrant(warrantId, {
    active: false,
    clearedBy: 'OFFICER_001',
    clearedAt: new Date().toISOString()
  });

  terminal.print(`\n✓ Warrant cancelled: ${warrantId}`, 'success');
}

async function handleListWarrants(terminal: any) {
  const warrants = Object.values(cadState.warrants) as Warrant[];
  const activeWarrants = warrants.filter(w => w.active && !w.executed);

  if (activeWarrants.length === 0) {
    terminal.print('No active warrants', 'info');
    return;
  }

  terminal.print(`\n=== ACTIVE WARRANTS (${activeWarrants.length}) ===`, 'system');

  const headers = ['ID', 'TYPE', 'NAME', 'REASON', 'ISSUED', 'EXPIRES'];
  const rows = activeWarrants.map(w => [
    w.warrantId.substring(0, 10),
    w.type,
    w.personName.substring(0, 15),
    w.reason.substring(0, 20),
    new Date(w.issuedAt).toLocaleDateString(),
    w.expiresAt ? new Date(w.expiresAt).toLocaleDateString() : 'N/A'
  ]);

  terminal.printTable(headers, rows);
}
