
import { createCommand } from '../commandBuilder';
import { cadActions, cadState, type CaseTask } from '~/stores/cadStore';
import { userActions } from '~/stores/userStore';
import { requireCaseLoaded } from '../commandBuilder';

export function registerCaseTaskCommands() {
  createCommand({
    name: 'task',
    description: 'Manage case follow-up tasks',
    usage: 'task add <title> | task list | task complete <taskId>',
    category: 'cases',
    handler: async ({ rawArgs, terminal }) => {
      const caseId = requireCaseLoaded({ rawArgs, terminal, fivem: {} as any, user: {} as any, args: {}, flags: {} } as any);
      if (!caseId) return;

      const subcommand = rawArgs[0];

      switch (subcommand) {
        case 'add':
          await handleAddTask(caseId, rawArgs.slice(1), terminal);
          break;
        case 'list':
          handleListTasks(caseId, terminal);
          break;
        case 'complete':
          await handleCompleteTask(caseId, rawArgs[1], terminal);
          break;
        default:
          terminal.print('Usage: task add <title> | task list | task complete <taskId>', 'error');
      }
    }
  });

  createCommand({
    name: 'addtask',
    description: 'Quick add task to current case',
    usage: 'addtask <title>',
    category: 'cases',
    handler: async ({ rawArgs, terminal }) => {
      const caseId = requireCaseLoaded({ rawArgs, terminal, fivem: {} as any, user: {} as any, args: {}, flags: {} } as any);
      if (!caseId) return;

      const title = rawArgs.join(' ');
      if (!title) {
        terminal.print('Usage: addtask <title>', 'error');
        return;
      }

      await handleAddTask(caseId, [title], terminal);
    }
  });
}

async function handleAddTask(caseId: string, args: string[], terminal: any) {
  let title = args.join(' ');

  if (!title) {
    title = await terminal.prompt('Task title:');
    if (!title) {
      terminal.print('Task creation cancelled', 'warning');
      return;
    }
  }

  const description = await terminal.prompt('Description (optional):');
  const assignedTo = await terminal.prompt('Assigned to (optional):');
  
  const dueDays = await terminal.prompt('Due in how many days? (0 for no due date):');
  const dueDate = dueDays && parseInt(dueDays) > 0 
    ? new Date(Date.now() + parseInt(dueDays) * 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Default 7 days

  const task: CaseTask = {
    taskId: `TASK_${Date.now()}`,
    caseId,
    title,
    description: description || undefined,
    assignedTo: assignedTo || userActions.getCurrentUserId(),
    dueDate,
    status: 'PENDING',
    createdBy: userActions.getCurrentUserId(),
    createdAt: new Date().toISOString(),
  };

  cadActions.addCaseTask(caseId, task);
  terminal.print(`✓ Task created: ${task.taskId}`, 'success');
  terminal.print(`  Title: ${title}`, 'info');
  terminal.print(`  Assigned: ${task.assignedTo}`, 'info');
  terminal.print(`  Due: ${new Date(dueDate).toLocaleDateString()}`, 'info');
}

function handleListTasks(caseId: string, terminal: any) {
  const caseData = cadState.cases[caseId];
  if (!caseData?.tasks?.length) {
    terminal.print('No tasks for this case', 'system');
    return;
  }

  const pending = caseData.tasks.filter(t => t.status === 'PENDING');
  const completed = caseData.tasks.filter(t => t.status === 'COMPLETED');

  if (pending.length > 0) {
    terminal.print(`\n=== PENDING TASKS (${pending.length}) ===`, 'system');
    terminal.printTable(
      ['ID', 'Title', 'Assigned', 'Due'],
      pending.map(t => [
        t.taskId.substring(0, 8),
        t.title.substring(0, 25),
        t.assignedTo,
        new Date(t.dueDate).toLocaleDateString(),
      ])
    );
  }

  const overdue = cadActions.getOverdueTasks(caseId);
  if (overdue.length > 0) {
    terminal.print(`\n⚠️ OVERDUE TASKS: ${overdue.length}`, 'error');
  }

  if (completed.length > 0) {
    terminal.print(`\n=== COMPLETED (${completed.length}) ===`, 'system');
    terminal.printTable(
      ['ID', 'Title', 'Completed'],
      completed.slice(-3).map(t => [
        t.taskId.substring(0, 8),
        t.title.substring(0, 30),
        t.completedAt ? new Date(t.completedAt).toLocaleDateString() : 'N/A',
      ])
    );
  }
}

async function handleCompleteTask(caseId: string, taskIdOrIndex: string, terminal: any) {
  const caseData = cadState.cases[caseId];
  const pending = cadActions.getPendingTasks(caseId);
  
  if (pending.length === 0) {
    terminal.print('No pending tasks', 'system');
    return;
  }

  let taskId = taskIdOrIndex;
  
  if (!taskId) {
    terminal.print('Pending tasks:', 'system');
    pending.forEach((t, i) => {
      terminal.print(`  [${i + 1}] ${t.title}`, 'info');
    });

    const selection = await terminal.prompt('Enter number to complete:');
    const index = parseInt(selection) - 1;
    
    if (isNaN(index) || index < 0 || index >= pending.length) {
      terminal.print('Invalid selection', 'error');
      return;
    }

    taskId = pending[index].taskId;
  } else {
    const index = parseInt(taskId) - 1;
    if (!isNaN(index) && index >= 0 && index < pending.length) {
      taskId = pending[index].taskId;
      terminal.print(`Selected: ${pending[index].title}`, 'info');
    }
  }

  const task = caseData?.tasks?.find(t => t.taskId === taskId);

  if (!task) {
    terminal.print(`Task not found: ${taskIdOrIndex}`, 'error');
    terminal.print('Tip: Use task list to see pending tasks, then use: task complete <number>', 'info');
    terminal.print('Example: task complete 1', 'info');
    return;
  }

  if (task.status === 'COMPLETED') {
    terminal.print('Task already completed', 'warning');
    return;
  }

  cadActions.completeCaseTask(caseId, taskId);
  terminal.print(`✓ Task completed: ${task.title}`, 'success');
}
