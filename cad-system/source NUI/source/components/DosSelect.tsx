import {
  Component,
  For,
  Show,
  createSignal,
  onMount,
  onCleanup,
} from 'solid-js';
import './DosSelect.css';

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

export interface DosSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}

export const DosSelect: Component<DosSelectProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [dropdownPos, setDropdownPos] = createSignal({
    top: 0,
    left: 0,
    width: 0,
  });
  let selectRef: HTMLDivElement | undefined;
  let triggerRef: HTMLDivElement | undefined;

  const selectedOption = () =>
    props.options.find((o) => o.value === props.value);

  const handleSelect = (value: string) => {
    props.onChange(value);
    setIsOpen(false);
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (selectRef && !selectRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  const updatePosition = () => {
    if (triggerRef) {
      const rect = triggerRef.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation();
    if (!props.disabled) {
      if (!isOpen()) {
        updatePosition();
      }
      setIsOpen(!isOpen());
    }
  };

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
  });

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('scroll', updatePosition, true);
    window.removeEventListener('resize', updatePosition);
  });

  return (
    <div class='dos-select-container' ref={selectRef}>
      <Show when={props.label}>
        <label class='dos-select-label'>{props.label}</label>
      </Show>

      <div
        ref={triggerRef}
        class={`dos-select ${props.disabled ? 'disabled' : ''} ${isOpen() ? 'open' : ''}`}
        onClick={handleToggle}
      >
        <div class='dos-select-trigger'>
          <span>
            {selectedOption()?.label || props.placeholder || 'Select...'}
          </span>
          <span class='dos-select-arrow'>▼</span>
        </div>
      </div>

      <Show when={isOpen()}>
        <div
          class='dos-select-dropdown'
          style={{
            position: 'fixed',
            top: `${dropdownPos().top}px`,
            left: `${dropdownPos().left}px`,
            width: `${dropdownPos().width}px`,
            'z-index': '10000',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <For each={props.options}>
            {(option) => (
              <div
                class={`dos-select-option ${option.value === props.value ? 'selected' : ''} `}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(option.value);
                }}
              >
                <span>{option.label}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
