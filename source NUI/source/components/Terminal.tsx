import { createSignal, For, Show, createEffect, onMount, onCleanup } from 'solid-js';
import { terminalState, terminalActions } from '~/stores/terminalStore';
import { promptState, promptActions, isActive, promptType, question, options } from '~/stores/promptStore';
import { registry } from '~/commands/registry';
import { cadState } from '~/stores/cadStore';
import { uiPrefsActions } from '~/stores/uiPreferencesStore';
import { CommandSuggestions } from './CommandSuggestions';

export function Terminal() {
  const [input, setInput] = createSignal('');
  let inputRef: HTMLInputElement | undefined;
  let terminalRef: HTMLDivElement | undefined;
  
  onMount(() => {
    scrollToBottom();
  });
  
  onCleanup(() => {
  });
  
  const scrollToBottom = (): void => {
    if (terminalRef) {
      terminalRef.scrollTop = terminalRef.scrollHeight;
    }
  };

  createEffect(() => {
    if (isActive()) {
      setTimeout(() => inputRef?.focus(), 0);
    }
  });

  const showInputLine = (): boolean => isActive();

  const getPromptPrefix = (): string => {
    if (isActive()) {
      switch (promptType()) {
        case 'text': return '?';
        case 'confirm': return '?';
        case 'select': return '#';
        default: return '>';
      }
    }
    if (cadState.currentCase) {
      return `[${cadState.currentCase.caseId}] >`;
    }
    return '>';
  };

  const getPlaceholder = (): string => {
    if (!isActive()) return '';
    switch (promptType()) {
      case 'text': return 'Enter text...';
      case 'confirm': return 'y/n';
      case 'select': return `1-${options()?.length || 0}`;
      default: return '';
    }
  };
  
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const value = input().trim();
    if (!value && !promptState.isActive) return;
    
    if (isActive()) {
      handlePromptSubmit(value);
      return;
    }
    
    setInput('');
    terminalActions.resetHistoryIndex();
    terminalActions.addInput(value);
    
    await registry.execute(value);
    
    setTimeout(scrollToBottom, 10);
    
    setTimeout(() => {
      inputRef?.focus();
    }, 0);
  };

  const handlePromptSubmit = (value: string): void => {
    const type = promptType();
    const opts = options();
    
    switch (type) {
      case 'text':
        terminalActions.addLine(`> ${value}`, 'input');
        promptActions.submit(value);
        break;
        
      case 'confirm':
        const isYes = value.toLowerCase() === 'y' || value.toLowerCase() === 'yes';
        const isNo = value.toLowerCase() === 'n' || value.toLowerCase() === 'no';
        
        if (!isYes && !isNo) {
          terminalActions.addLine('Please enter y/yes or n/no', 'error');
          return;
        }
        
        terminalActions.addLine(`> ${isYes ? 'yes' : 'no'}`, 'input');
        promptActions.submit(isYes);
        break;
        
      case 'select':
        const selectedIndex = parseInt(value) - 1;
        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= (opts?.length || 0)) {
          terminalActions.addLine(`Please enter a number between 1 and ${opts?.length}`, 'error');
          return;
        }
        
        const selectedOption = opts![selectedIndex];
        terminalActions.addLine(`> ${selectedOption}`, 'input');
        promptActions.submit(selectedOption);
        break;
    }
    
    setInput('');
    
    setTimeout(() => {
      inputRef?.focus();
    }, 0);
  };
  
  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && isActive()) {
      e.preventDefault();
      terminalActions.addLine('^C (cancelled)', 'system');
      promptActions.cancel();
      setInput('');
      return;
    }

    if (isActive()) {
      if (e.key === 'Enter') {
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const historyItem = terminalActions.getHistoryItem('up');
      if (historyItem !== null) {
        setInput(historyItem);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const historyItem = terminalActions.getHistoryItem('down');
      if (historyItem !== null) {
        setInput(historyItem);
      } else {
        setInput('');
        terminalActions.resetHistoryIndex();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const parts = input().split(' ');
      const current = parts[parts.length - 1].toLowerCase();
      
      if (parts.length === 1) {
        const commands = registry.getAll();
        const matches = commands.filter(cmd => 
          cmd.name.startsWith(current) || 
          (cmd.aliases && cmd.aliases.some(alias => alias.startsWith(current)))
        );
        
        if (matches.length === 1) {
          setInput(matches[0].name);
        } else if (matches.length > 1) {
          terminalActions.addLine(`Matches: ${matches.map(m => m.name).join(', ')}`, 'system');
        }
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      setInput('');
      terminalActions.addLine('^C', 'system');
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      terminalActions.clear();
    }
  };
  
  const getLineClass = (type: string): string => {
    switch (type) {
      case 'input': return 'terminal-line--input';
      case 'error': return 'terminal-line--error';
      case 'system': return 'terminal-line--system';
      default: return 'terminal-line--output';
    }
  };
  
  return (
    <div class="terminal">
      <div class="terminal-header">
        <span class="terminal-title">C.A.D. TERMINAL v1.0</span>
        <span class="terminal-status">
          {terminalState.isProcessing ? '[PROCESSING...]' : 
           promptState.isActive ? `[PROMPT: ${promptState.type?.toUpperCase()}]` : '[READY]'}
        </span>
      </div>
      
      <div class="terminal-body" ref={terminalRef}>
        <For each={terminalState.lines}>
          {(line) => (
            <div class={`terminal-line ${getLineClass(line.type)}`}>
              <pre class="terminal-content">{line.content}</pre>
            </div>
          )}
        </For>
        
        <Show when={isActive() && promptType() === 'select'}>
          <div class="terminal-line terminal-line--system">
            <pre class="terminal-content">{question()}</pre>
          </div>
          <For each={options()}>
            {(option, index) => (
              <div class="terminal-line terminal-line--output">
                <pre class="terminal-content">  [{index() + 1}] {option}</pre>
              </div>
            )}
          </For>
        </Show>
        
        <Show when={isActive() && promptType() === 'confirm'}>
          <div class="terminal-line terminal-line--system">
            <pre class="terminal-content">{question()} (y/n)</pre>
          </div>
        </Show>

        <Show when={isActive() && promptType() === 'text'}>
          <div class="terminal-line terminal-line--system">
            <pre class="terminal-content">{question()}</pre>
          </div>
        </Show>
      </div>
      
      <Show when={showInputLine()}>
        <form class="terminal-input-line" onSubmit={handleSubmit}>
          <span class="terminal-prompt">{getPromptPrefix()}</span>
          <input
            ref={inputRef}
            type="text"
            class="terminal-input"
            value={input()}
            onInput={(e) => {
              setInput(e.currentTarget.value);
              uiPrefsActions.setTyping(e.currentTarget.value.length > 0);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => uiPrefsActions.setTerminalFocused(true)}
            onBlur={() => {
              uiPrefsActions.setTerminalFocused(false);
              uiPrefsActions.setTyping(false);
            }}
            disabled={terminalState.isProcessing && !isActive()}
            placeholder={getPlaceholder()}
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck={false}
          />
        </form>
      </Show>
      
      <Show when={showInputLine()}>
        <CommandSuggestions />
      </Show>
    </div>
  );
}
