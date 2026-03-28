
import { createCommand } from '../commandBuilder';
import type { TerminalAPI } from '../types';

interface MedicalItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  description: string;
}

const medicalInventory: MedicalItem[] = [
  { id: 'MED001', name: 'Morphine', category: 'Pain Management', quantity: 50, unit: 'mg', description: 'Opioid analgesic' },
  { id: 'MED002', name: 'Epinephrine', category: 'Emergency', quantity: 20, unit: 'doses', description: 'Cardiac stimulant' },
  { id: 'MED003', name: 'Bandages', category: 'First Aid', quantity: 100, unit: 'units', description: 'Sterile gauze bandages' },
  { id: 'MED004', name: 'Antibiotics', category: 'Infection', quantity: 30, unit: 'doses', description: 'Broad spectrum' },
  { id: 'MED005', name: 'IV Saline', category: 'Fluids', quantity: 40, unit: 'bags', description: '0.9% Sodium Chloride' },
  { id: 'MED006', name: 'Oxygen', category: 'Respiratory', quantity: 15, unit: 'tanks', description: 'Medical grade O2' },
  { id: 'MED007', name: 'Defibrillator', category: 'Equipment', quantity: 3, unit: 'units', description: 'AED device' },
  { id: 'MED008', name: 'Suture Kit', category: 'Surgery', quantity: 25, unit: 'kits', description: 'Sterile sutures' },
  { id: 'MED009', name: 'Splints', category: 'Orthopedic', quantity: 20, unit: 'units', description: 'Various sizes' },
  { id: 'MED010', name: 'Tourniquet', category: 'Trauma', quantity: 15, unit: 'units', description: 'Combat application' }
];

export function registerInventoryCommand(): void {
  createCommand({
    name: 'inventory',
    description: 'View and manage EMS medical supplies',
    usage: 'inventory <view|use|restock>',
    category: 'EMS',
    permissions: ['ems'],
    args: [
      {
        name: 'action',
        type: 'string',
        required: false,
        description: 'Action: view, use, restock'
      }
    ],
    handler: async ({ args, terminal }) => {
      const action = (args.action as string)?.toLowerCase() || await terminal.select(
        'Select inventory action:',
        ['view', 'use', 'restock']
      );

      switch (action) {
        case 'view':
          await handleViewInventory(terminal);
          break;
        case 'use':
          await handleUseItem(terminal);
          break;
        case 'restock':
          await handleRestock(terminal);
          break;
        default:
          terminal.print(`Unknown action: ${action}`, 'error');
          terminal.print('Usage: inventory <view|use|restock>', 'system');
      }
    }
  });
}

async function handleViewInventory(terminal: TerminalAPI): Promise<void> {
  terminal.print('\n=== MEDICAL INVENTORY ===', 'system');

  const categories = [...new Set(medicalInventory.map(item => item.category))];

  for (const category of categories) {
    terminal.print(`\n[${category.toUpperCase()}]`, 'system');

    const items = medicalInventory.filter(item => item.category === category);
    const headers = ['ID', 'NAME', 'QTY', 'UNIT'];
    const rows = items.map(item => [
      item.id,
      item.name.substring(0, 15),
      item.quantity.toString(),
      item.unit
    ]);

    terminal.printTable(headers, rows);
  }

  const totalItems = medicalInventory.reduce((sum, item) => sum + item.quantity, 0);
  terminal.print(`\nTotal items in stock: ${totalItems}`, 'info');
}

async function handleUseItem(terminal: TerminalAPI): Promise<void> {
  terminal.print('\n=== USE MEDICAL ITEM ===', 'system');

  const itemNames = medicalInventory.map(item => `${item.id} - ${item.name} (${item.quantity} ${item.unit})`);
  const selected = await terminal.select('Select item to use:', itemNames);

  const itemId = selected.split(' - ')[0];
  const item = medicalInventory.find(i => i.id === itemId);

  if (!item) {
    terminal.print('Item not found', 'error');
    return;
  }

  if (item.quantity <= 0) {
    terminal.print(`Out of stock: ${item.name}`, 'error');
    return;
  }

  const quantity = await terminal.prompt(`Quantity to use (max ${item.quantity}):`);
  const qty = parseInt(quantity as string);

  if (isNaN(qty) || qty <= 0 || qty > item.quantity) {
    terminal.print('Invalid quantity', 'error');
    return;
  }

  const patientId = await terminal.prompt('Patient ID (optional):');
  const notes = await terminal.prompt('Usage notes:');

  terminal.print('\n=== CONFIRM USAGE ===', 'system');
  terminal.print(`Item: ${item.name}`, 'info');
  terminal.print(`Quantity: ${qty} ${item.unit}`, 'info');
  if (patientId) terminal.print(`Patient: ${patientId}`, 'info');
  if (notes) terminal.print(`Notes: ${notes}`, 'info');

  const confirmed = await terminal.confirm('Confirm usage?');

  if (!confirmed) {
    terminal.print('Usage cancelled', 'warning');
    return;
  }

  item.quantity -= qty;

  terminal.print(`\n✓ Used ${qty} ${item.unit} of ${item.name}`, 'success');
  terminal.print(`Remaining stock: ${item.quantity} ${item.unit}`, 'info');

  if (item.quantity < 10) {
    terminal.print(`WARNING: Low stock on ${item.name}!`, 'warning');
  }
}

async function handleRestock(terminal: TerminalAPI): Promise<void> {
  terminal.print('\n=== RESTOCK INVENTORY ===', 'system');

  const itemNames = medicalInventory.map(item => `${item.id} - ${item.name} (${item.quantity} ${item.unit})`);
  const selected = await terminal.select('Select item to restock:', itemNames);

  const itemId = selected.split(' - ')[0];
  const item = medicalInventory.find(i => i.id === itemId);

  if (!item) {
    terminal.print('Item not found', 'error');
    return;
  }

  const quantity = await terminal.prompt('Quantity to add:');
  const qty = parseInt(quantity as string);

  if (isNaN(qty) || qty <= 0) {
    terminal.print('Invalid quantity', 'error');
    return;
  }

  const reason = await terminal.prompt('Restock reason (delivery, returned, etc):');

  terminal.print('\n=== CONFIRM RESTOCK ===', 'system');
  terminal.print(`Item: ${item.name}`, 'info');
  terminal.print(`Current: ${item.quantity} ${item.unit}`, 'info');
  terminal.print(`Adding: ${qty} ${item.unit}`, 'info');
  terminal.print(`New total: ${item.quantity + qty} ${item.unit}`, 'info');

  const confirmed = await terminal.confirm('Confirm restock?');

  if (!confirmed) {
    terminal.print('Restock cancelled', 'warning');
    return;
  }

  item.quantity += qty;

  terminal.print(`\n✓ Restocked ${item.name}`, 'success');
  terminal.print(`New quantity: ${item.quantity} ${item.unit}`, 'info');
  if (reason) terminal.print(`Reason: ${reason}`, 'info');
}
