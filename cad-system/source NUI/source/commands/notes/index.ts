
import { createCommand, requireCaseLoaded } from '../commandBuilder';
import { cadActions, cadState, type Note } from '~/stores/cadStore';

const NOTE_TYPES = ['general', 'observation', 'interview', 'evidence'] as const;
type NoteType = typeof NOTE_TYPES[number];

export function registerNoteCommands() {
  createCommand({
    name: 'addnote',
    aliases: ['note-add', 'nadd'],
    description: 'Add a note to a case',
    usage: 'addnote [type] [content] | addnote [case_id] [type] [content]',
    handler: async ({ rawArgs, terminal }) => {
      let caseId: string;
      let noteType: NoteType;
      let content: string;

      if (rawArgs.length === 0) {
        const currentId = requireCaseLoaded({ rawArgs, terminal, fivem: {} as any, user: {} as any, args: {}, flags: {} } as any);
        if (!currentId) return;
        caseId = currentId;
        
        noteType = await terminal.select('Select note type:', [...NOTE_TYPES]) as NoteType;
        content = await terminal.prompt('Enter note content:');
        
        if (!content) {
          terminal.print('Note creation cancelled - no content provided', 'error');
          return;
        }
      } else {
        const firstArg = rawArgs[0].toLowerCase();
        
        if (NOTE_TYPES.includes(firstArg as NoteType)) {
          const currentId = requireCaseLoaded({ rawArgs, terminal, fivem: {} as any, user: {} as any, args: {}, flags: {} } as any);
          if (!currentId) return;
          caseId = currentId;
          noteType = firstArg as NoteType;
          
          if (rawArgs.length < 2) {
            content = await terminal.prompt('Enter note content:');
            if (!content) {
              terminal.print('Note creation cancelled - no content provided', 'error');
              return;
            }
          } else {
            content = rawArgs.slice(1).join(' ');
          }
        } else {
          caseId = firstArg;
          
          if (rawArgs.length < 2) {
            const targetCase = cadState.cases[caseId];
            if (!targetCase) {
              terminal.print(`Case not found: ${caseId}`, 'error');
              return;
            }
            
            noteType = await terminal.select('Select note type:', [...NOTE_TYPES]) as NoteType;
            content = await terminal.prompt('Enter note content:');
            
            if (!content) {
              terminal.print('Note creation cancelled - no content provided', 'error');
              return;
            }
          } else {
            noteType = rawArgs[1].toLowerCase() as NoteType;
            
            if (rawArgs.length < 3) {
              content = await terminal.prompt('Enter note content:');
              if (!content) {
                terminal.print('Note creation cancelled - no content provided', 'error');
                return;
              }
            } else {
              content = rawArgs.slice(2).join(' ');
            }
          }
        }
      }

      if (!NOTE_TYPES.includes(noteType)) {
        terminal.print(`Invalid note type: ${noteType}`, 'error');
        terminal.print(`Valid types: ${NOTE_TYPES.join(', ')}`, 'system');
        return;
      }

      const targetCase = cadState.cases[caseId];
      if (!targetCase) {
        terminal.print(`Case not found: ${caseId}`, 'error');
        return;
      }

      const note: Note = {
        id: `NOTE_${Date.now()}`,
        caseId: caseId,
        author: 'OFFICER_101',
        content: content,
        timestamp: new Date().toISOString(),
        type: noteType,
      };

      cadActions.addCaseNote(caseId, note);

      terminal.print(`✓ Note added to case ${caseId}`, 'success');
      terminal.print(`  Type: ${noteType}`, 'info');
      terminal.print(`  Content: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`, 'info');
    }
  });

  createCommand({
    name: 'notes',
    description: 'View notes for a case',
    usage: 'notes [case_id]',
    handler: async ({ rawArgs, terminal }) => {
      let caseId: string;
      
      if (rawArgs.length === 0) {
        const currentId = requireCaseLoaded({ rawArgs, terminal, fivem: {} as any, user: {} as any, args: {}, flags: {} } as any);
        if (!currentId) return;
        caseId = currentId;
      } else {
        caseId = rawArgs[0];
      }

      const targetCase = cadState.cases[caseId];
      if (!targetCase) {
        terminal.print(`Case not found: ${caseId}`, 'error');
        return;
      }

      const notes = targetCase.notes || [];
      
      if (notes.length === 0) {
        terminal.print(`No notes for case ${caseId}`, 'system');
        return;
      }

      terminal.print(`=== NOTES FOR CASE ${caseId} ===`, 'system');
      terminal.printTable(
        ['Type', 'Author', 'Date', 'Content'],
        notes.map(note => [
          note.type.substring(0, 10).toUpperCase(),
          note.author.substring(0, 10),
          new Date(note.timestamp).toLocaleDateString(),
          note.content.substring(0, 30) + (note.content.length > 30 ? '...' : '')
        ])
      );
    }
  });
}
