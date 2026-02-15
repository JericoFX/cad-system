
import { For, Show, createMemo } from 'solid-js';
import { auditState, auditActions, type AuditResult } from '~/stores/auditStore';

export function AuditViewer() {
  const entries = createMemo(() => auditActions.getFilteredEntries());
  const stats = createMemo(() => auditActions.getStats());

  const getResultIcon = (result: AuditResult): string => {
    const icons: Record<AuditResult, string> = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      cancelled: '🚫',
    };
    return icons[result] || '•';
  };

  const getResultColor = (result: AuditResult): string => {
    const colors: Record<AuditResult, string> = {
      success: '#00ff00',
      error: '#ff0000',
      warning: '#ff8000',
      cancelled: '#808080',
    };
    return colors[result];
  };

  return (
    <Show when={auditState.isViewerOpen}>
      <div class="audit-viewer-overlay" onClick={() => auditActions.closeViewer()}>
        <div class="audit-viewer" onClick={(e) => e.stopPropagation()}>
          <div class="audit-header">
            <h2>📋 Command Audit Log</h2>
            <button class="close-btn" onClick={() => auditActions.closeViewer()}>
              X
            </button>
          </div>

          <div class="audit-stats">
            <div class="stat-box">
              <span class="stat-value">{stats().total}</span>
              <span class="stat-label">Total</span>
            </div>
            <div class="stat-box success">
              <span class="stat-value">{stats().success}</span>
              <span class="stat-label">Success</span>
            </div>
            <div class="stat-box error">
              <span class="stat-value">{stats().error}</span>
              <span class="stat-label">Errors</span>
            </div>
            <div class="stat-box">
              <span class="stat-value">{stats().withCase}</span>
              <span class="stat-label">With Case</span>
            </div>
          </div>

          <div class="audit-filters">
            <input
              type="text"
              placeholder="Search commands, officers, cases..."
              value={auditState.searchQuery}
              onInput={(e) => auditActions.setSearchQuery(e.currentTarget.value)}
              class="audit-search"
            />
            <div class="filter-buttons">
              <button
                class={auditState.filter === 'all' ? 'active' : ''}
                onClick={() => auditActions.setFilter('all')}
              >
                All
              </button>
              <button
                class={auditState.filter === 'success' ? 'active' : ''}
                onClick={() => auditActions.setFilter('success')}
              >
                Success
              </button>
              <button
                class={auditState.filter === 'error' ? 'active' : ''}
                onClick={() => auditActions.setFilter('error')}
              >
                Errors
              </button>
              <button
                class={auditState.filter === 'case' ? 'active' : ''}
                onClick={() => auditActions.setFilter('case')}
              >
                With Case
              </button>
            </div>
          </div>

          <div class="audit-entries">
            <Show
              when={entries().length > 0}
              fallback={<div class="audit-empty">No audit entries found</div>}
            >
              <For each={entries()}>
                {(entry) => (
                  <div
                    class={`audit-entry ${entry.result} ${auditState.selectedEntry?.id === entry.id ? 'selected' : ''}`}
                    onClick={() => auditActions.selectEntry(entry)}
                  >
                    <div class="entry-main">
                      <span class="entry-icon" style={{ color: getResultColor(entry.result) }}>
                        {getResultIcon(entry.result)}
                      </span>
                      <div class="entry-info">
                        <div class="entry-command">
                          <code>{entry.command}</code>
                          {entry.args.length > 0 && (
                            <span class="entry-args">{entry.args.join(' ')}</span>
                          )}
                        </div>
                        <div class="entry-meta">
                          <span class="entry-officer">👤 {entry.officerBadge}</span>
                          <span class="entry-time">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                          {entry.linkedCaseId && (
                            <span class="entry-link case">📁 {entry.linkedCaseId}</span>
                          )}
                          {entry.linkedCallId && (
                            <span class="entry-link call">📞 {entry.linkedCallId}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Show when={entry.resultMessage}>
                      <div class="entry-message">{entry.resultMessage}</div>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </div>

          <div class="audit-footer">
            <button onClick={() => auditActions.exportToNote()}>📋 Export to Note</button>
            <button onClick={() => auditActions.clearEntries()}>🗑️ Clear History</button>
          </div>
        </div>
      </div>
    </Show>
  );
}

export function AuditQuickButton() {
  return (
    <button class="audit-quick-btn" onClick={() => auditActions.toggleViewer()} title="Command Audit Log">
      <span>📋</span>
      <Show when={auditState.entries.length > 0}>
        <span class="audit-count">{auditState.entries.length}</span>
      </Show>
    </button>
  );
}
