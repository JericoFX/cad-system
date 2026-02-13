
import { terminalActions } from '~/stores/terminalStore';
import { promptActions } from '~/stores/promptStore';
import type { TerminalAPI } from './types';

export const terminalAPI: TerminalAPI = {
  print(text: string, type: 'info' | 'success' | 'error' | 'warning' | 'command' | 'system' = 'info') {
    const typeMap: Record<string, TerminalLine['type']> = {
      info: 'output',
      success: 'output',
      error: 'error',
      warning: 'output',
      command: 'input',
      system: 'system'
    };
    terminalActions.addLine(text, typeMap[type] || 'output');
  },

  printTable(headers: string[], rows: string[][]) {
    const colWidths = headers.map((h, i) => {
      const maxDataWidth = Math.max(...rows.map(r => (r[i] || '').length));
      return Math.max(h.length, maxDataWidth) + 2;
    });

    const makeLine = (cells: string[], char: string) => {
      return char + cells.map((c, i) => c.padEnd(colWidths[i])).join(char) + char;
    };

    const topLine = makeLine(headers.map(() => '─'), '┌') + '┐';
    const headerLine = makeLine(headers, '│') + '│';
    const separatorLine = makeLine(headers.map(() => '─'), '├') + '┤';
    const bottomLine = makeLine(headers.map(() => '─'), '└') + '┘';

    terminalActions.addLine(topLine, 'system');
    terminalActions.addLine(headerLine, 'system');
    terminalActions.addLine(separatorLine, 'system');

    rows.forEach(row => {
      terminalActions.addLine(makeLine(row, '│') + '│', 'output');
    });

    terminalActions.addLine(bottomLine, 'system');
  },

  printList(items: string[], bullet: string = '•') {
    items.forEach(item => {
      terminalActions.addLine(`  ${bullet} ${item}`, 'output');
    });
  },

  printJSON(data: any) {
    const jsonStr = JSON.stringify(data, null, 2);
    terminalActions.addLine(jsonStr, 'output');
  },

  printCard(title: string, fields: Record<string, string>) {
    terminalActions.addLine(`=== ${title} ===`, 'system');
    Object.entries(fields).forEach(([key, value]) => {
      terminalActions.addLine(`${key}: ${value}`, 'output');
    });
  },

  clear() {
    terminalActions.clear();
  },

  async progress(char: string | string[], durationMs: number): Promise<void> {
    const chars = Array.isArray(char) ? char : [char];
    const interval = 100;
    const steps = durationMs / interval;
    let currentStep = 0;
    const lineId = `progress-${Date.now()}`;

    return new Promise((resolve) => {
      const intervalId = setInterval(() => {
        currentStep++;
        const charIndex = currentStep % chars.length;
        const progressChars = chars[charIndex].repeat(Math.min(currentStep, 20));
        
        terminalActions.addOrUpdateLine(lineId, `[${progressChars}]`, 'system');

        if (currentStep >= steps) {
          clearInterval(intervalId);
          resolve();
        }
      }, interval);
    });
  },

  showLoading(text: string): () => void {
    const lineId = `loading-${Date.now()}`;
    const chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;

    terminalActions.addOrUpdateLine(lineId, `${chars[0]} ${text}...`, 'system');

    const intervalId = setInterval(() => {
      i = (i + 1) % chars.length;
      terminalActions.addOrUpdateLine(lineId, `${chars[i]} ${text}...`, 'system');
    }, 80);

    return () => {
      clearInterval(intervalId);
      terminalActions.addOrUpdateLine(lineId, `✓ ${text}`, 'output');
    };
  },

  async prompt(question: string): Promise<string> {
    return promptActions.prompt(question);
  },

  async confirm(question: string): Promise<boolean> {
    return promptActions.confirm(question);
  },

  async select(question: string, options: string[]): Promise<string> {
    return promptActions.select(question, options);
  },

  openModal(modalName: string, data?: any) {
    terminalActions.setActiveModal(modalName, data);
  },

  closeModal() {
    terminalActions.setActiveModal(null);
  },

  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  newLine() {
    terminalActions.addLine('', 'output');
  },

  clearLine() {
  }
};

import type { TerminalLine } from '~/stores/terminalStore';
