import { 
  Component, 
  createSignal, 
  createMemo, 
  onMount,
  For, 
  Show, 
  mergeProps,
  splitProps
} from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { cadState, cadActions } from '~/stores/cadStore';
import { DosSelect } from '../DosSelect';
import type { Fine, Person, Vehicle } from '~/stores/cadStore';
import { fetchNui } from '~/utils/fetchNui';

interface FineManagerProps {
  initialTargetId?: string;
  initialTargetType?: 'PERSON' | 'VEHICLE';
}

export const FineManager: Component<FineManagerProps> = (props) => {
  const merged = mergeProps(
    { initialTargetId: '', initialTargetType: 'PERSON' as const },
    props
  );
  
  const [local] = splitProps(merged, ['initialTargetId', 'initialTargetType']);

  const [targetType, setTargetType] = createSignal<'PERSON' | 'VEHICLE'>(local.initialTargetType);
  const [targetId, setTargetId] = createSignal(local.initialTargetId);
  const [selectedCategory, setSelectedCategory] = createSignal('traffic');
  const [selectedFine, setSelectedFine] = createSignal<any>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isSearching, setIsSearching] = createSignal(false);

  const [finesCatalog, setFinesCatalog] = createSignal<Record<string, Array<{ code: string; description: string; amount: number; jailTime: number; category?: string }>>>({});
  
  const loadFines = async () => {
    try {
      const remoteCatalog = await fetchNui<Array<{ code: string; description: string; amount: number; jailTime: number; category?: string }>>('cad:getFineCatalog');
      const grouped: Record<string, Array<{ code: string; description: string; amount: number; jailTime: number; category?: string }>> = {
        traffic: [],
        criminal: [],
        weapons: [],
      };

      (remoteCatalog || []).forEach((item) => {
        if (typeof item.category === 'string') {
          const category = item.category.toLowerCase();
          if (grouped[category]) {
            grouped[category].push(item);
            return;
          }
        }

        const codePrefix = (item.code || '').charAt(0).toUpperCase();
        if (codePrefix === 'T') grouped.traffic.push(item);
        else if (codePrefix === 'C') grouped.criminal.push(item);
        else grouped.weapons.push(item);
      });

      setFinesCatalog(grouped);
    } catch (error) {
      console.error('Failed to load fines catalog:', error);
      setFinesCatalog({
        traffic: [
          { code: 'T001', description: 'Exceso de velocidad', amount: 500, jailTime: 0 },
          { code: 'T008', description: 'DUI', amount: 5000, jailTime: 30 }
        ],
        criminal: [
          { code: 'C001', description: 'Robo menor', amount: 2000, jailTime: 10 }
        ],
        weapons: [
          { code: 'W001', description: 'Arma sin licencia', amount: 3000, jailTime: 15 }
        ]
      });
    }
  };

  onMount(() => {
    void loadFines();
  });

  const filteredTargets = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    
    if (targetType() === 'PERSON') {
      const persons = Object.values(cadState.persons);
      if (!query) return persons.slice(0, 20); // Show first 20 if no search
      
      return persons.filter(p => 
        p.firstName?.toLowerCase().includes(query) ||
        p.lastName?.toLowerCase().includes(query) ||
        p.citizenid?.toLowerCase().includes(query)
      ).slice(0, 20);
    } else {
      const vehicles = Object.values(cadState.vehicles);
      if (!query) return vehicles.slice(0, 20); // Show first 20 if no search
      
      return vehicles.filter(v => 
        v.plate?.toLowerCase().includes(query) ||
        v.model?.toLowerCase().includes(query) ||
        v.ownerName?.toLowerCase().includes(query)
      ).slice(0, 20);
    }
  });

  const targetOptions = createMemo(() => {
    const targets = filteredTargets();
    if (targetType() === 'PERSON') {
      return (targets as Person[]).map(p => ({
        value: p.citizenid,
        label: `${p.firstName} ${p.lastName} (${p.citizenid})`
      }));
    } else {
      return (targets as Vehicle[]).map(v => ({
        value: v.plate,
        label: `${v.plate} - ${v.model} (${v.ownerName})`
      }));
    }
  });

  const categoryOptions = [
    { value: 'traffic', label: 'TRÁFICO', color: 'priority-low' },
    { value: 'criminal', label: 'CRIMINAL', color: 'priority-high' },
    { value: 'weapons', label: 'ARMAS', color: 'priority-med' }
  ];

  const currentFines = createMemo(() => {
    return finesCatalog()[selectedCategory()] || [];
  });

  const targetInfo = createMemo(() => {
    if (!targetId()) return null;
    if (targetType() === 'PERSON') {
      return cadState.persons[targetId()];
    } else {
      return cadState.vehicles[targetId()];
    }
  });

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const handleIssueFine = async () => {
    if (!targetId() || !selectedFine()) {
      terminalActions.addLine('Selecciona un objetivo y una multa', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const fineData = await fetchNui<Fine>('cad:createFine', {
        targetType: targetType(),
        targetId: targetId(),
        targetName: targetType() === 'PERSON' 
          ? `${(targetInfo() as Person).firstName} ${(targetInfo() as Person).lastName}`
          : `${(targetInfo() as Vehicle).plate} - ${(targetInfo() as Vehicle).model}`,
        fineCode: selectedFine().code,
        description: selectedFine().description,
        amount: selectedFine().amount,
        jailTime: selectedFine().jailTime,
        isBail: false,
      });

      cadActions.addFine(fineData);

      terminalActions.addLine(`Multa emitida: ${fineData.fineId}`, 'output');
      terminalActions.addLine(`Monto: $${fineData.amount}`, 'output');
      terminalActions.addLine(`Tiempo cárcel: ${fineData.jailTime} min`, 'output');

      setSelectedFine(null);
      
      setTimeout(() => closeModal(), 1000);
    } catch (error) {
      terminalActions.addLine(`Error al emitir multa: ${error}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={closeModal}>
      <div class="modal-content fine-manager" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== EMITIR MULTA ===</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>

        <div class="fine-form">
          <div class="form-section">
            <DosSelect
              label="[TIPO DE OBJETIVO]"
              options={[
                { value: 'PERSON', label: 'PERSONA', color: '' },
                { value: 'VEHICLE', label: 'VEHÍCULO', color: '' }
              ]}
              value={targetType()}
              onChange={(value) => {
                setTargetType(value as 'PERSON' | 'VEHICLE');
                setTargetId('');
              }}
              placeholder="Seleccionar tipo..."
            />
          </div>

          <div class="form-section">
            <label class="form-label">
              {targetType() === 'PERSON' ? '[BUSCAR PERSONA]' : '[BUSCAR VEHÍCULO]'}
            </label>
            <input
              type="text"
              class="dos-input"
              placeholder={targetType() === 'PERSON' 
                ? 'Escribe nombre o ID...' 
                : 'Escribe placa, modelo o propietario...'
              }
              value={searchQuery()}
              onInput={(e) => {
                setSearchQuery(e.currentTarget.value);
                setIsSearching(true);
              }}
              onFocus={() => setIsSearching(true)}
            />
            
            <Show when={isSearching() && targetOptions().length > 0}>
              <div class="search-results" style={{
                'max-height': '200px',
                'overflow-y': 'auto',
                'border': '1px solid var(--terminal-border)',
                'margin-top': '8px',
                'background': 'var(--terminal-bg)'
              }}>
                <For each={targetOptions()}>
                  {(option) => (
                    <div 
                      class={`search-result-item ${targetId() === option.value ? 'selected' : ''}`}
                      style={{
                        'padding': '8px 12px',
                        'cursor': 'pointer',
                        'border-bottom': '1px solid var(--terminal-border-dim)'
                      }}
                      onClick={() => {
                        setTargetId(option.value);
                        setSearchQuery(option.label);
                        setIsSearching(false);
                      }}
                    >
                      {option.label}
                    </div>
                  )}
                </For>
              </div>
            </Show>
            
            <Show when={searchQuery().length > 0 && targetOptions().length === 0}>
              <div class="no-results" style={{
                'padding': '12px',
                'color': 'var(--terminal-error)',
                'text-align': 'center'
              }}>
                No se encontraron resultados
              </div>
            </Show>
            
            <Show when={!isSearching() && targetId()}>
              <div class="selected-target" style={{
                'padding': '8px 12px',
                'background': 'rgba(0, 255, 0, 0.1)',
                'border': '1px solid var(--terminal-border)',
                'margin-top': '8px'
              }}>
                <strong>Seleccionado:</strong> {targetInfo() ? (
                  targetType() === 'PERSON' 
                    ? `${(targetInfo() as Person).firstName} ${(targetInfo() as Person).lastName}`
                    : `${(targetInfo() as Vehicle).plate} - ${(targetInfo() as Vehicle).model}`
                ) : targetId()}
                <button 
                  class="btn-small"
                  style={{ 'margin-left': '10px' }}
                  onClick={() => {
                    setTargetId('');
                    setSearchQuery('');
                  }}
                >
                  [CAMBIAR]
                </button>
              </div>
            </Show>
          </div>

          <Show when={targetInfo()}>
            <div class="target-info">
              <div class="info-box">
                {targetType() === 'PERSON' ? (
                  <>
                    <div class="info-line">
                      <strong>Nombre:</strong> {(targetInfo() as Person).firstName} {(targetInfo() as Person).lastName}
                    </div>
                    <div class="info-line">
                      <strong>ID:</strong> {(targetInfo() as Person).citizenid}
                    </div>
                  </>
                ) : (
                  <>
                    <div class="info-line">
                      <strong>Placa:</strong> {(targetInfo() as Vehicle).plate}
                    </div>
                    <div class="info-line">
                      <strong>Modelo:</strong> {(targetInfo() as Vehicle).model}
                    </div>
                    <div class="info-line">
                      <strong>Propietario:</strong> {(targetInfo() as Vehicle).ownerName}
                    </div>
                  </>
                )}
              </div>
            </div>
          </Show>

          <div class="form-section">
            <DosSelect
              label="[CATEGORÍA DE MULTA]"
              options={categoryOptions}
              value={selectedCategory()}
              onChange={setSelectedCategory}
              placeholder="Seleccionar categoría..."
            />
          </div>

          <div class="form-section">
            <label class="form-label">[SELECCIONAR MULTA]</label>
            <div class="fines-list">
              <For each={currentFines()}>
                {(fine) => (
                  <div 
                    class={`fine-item ${selectedFine()?.code === fine.code ? 'selected' : ''}`}
                    onClick={() => setSelectedFine(fine)}
                  >
                    <div class="fine-code">{fine.code}</div>
                    <div class="fine-description">{fine.description}</div>
                    <div class="fine-amount">
                      <span class="amount">${fine.amount}</span>
                      <Show when={fine.jailTime > 0}>
                        <span class="jail-time">+ {fine.jailTime}min</span>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          <Show when={selectedFine()}>
            <div class="fine-preview">
              <div class="form-label">[RESUMEN DE MULTA]</div>
              <div class="preview-box">
                <div><strong>Código:</strong> {selectedFine().code}</div>
                <div><strong>Descripción:</strong> {selectedFine().description}</div>
                <div><strong>Monto:</strong> ${selectedFine().amount}</div>
                <Show when={selectedFine().jailTime > 0}>
                  <div><strong>Tiempo de cárcel:</strong> {selectedFine().jailTime} minutos</div>
                </Show>
              </div>
            </div>
          </Show>

          <div class="modal-footer">
            <button 
              class="btn btn-primary" 
              onClick={handleIssueFine}
              disabled={isSubmitting() || !targetId() || !selectedFine()}
            >
              {isSubmitting() ? '[PROCESANDO...]' : '[EMITIR MULTA]'}
            </button>
            <button class="btn" onClick={closeModal}>
              [CANCELAR]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
