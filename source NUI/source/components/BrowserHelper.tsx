import { isEnvBrowser } from '~/utils/misc';
import { appActions } from '~/stores/appStore';

export function BrowserHelper() {
  const emitCadOpened = () => {
    window.postMessage(
      {
        action: 'cad:opened',
        data: {
          terminalId: 'mock-mrpd-frontdesk',
          location: 'Mission Row Front Desk',
          hasContainer: true,
          hasReader: true,
        },
      },
      '*'
    );
  };

  const openCad = () => {
    localStorage.setItem('cad-mock-no-callsign', '0');
    appActions.updateBootConfig({ enabled: true, skippable: true, soundsEnabled: true });
    emitCadOpened();
  };

  const openCadWithoutCallsign = () => {
    localStorage.setItem('cad-mock-no-callsign', '1');
    appActions.updateBootConfig({ enabled: true, skippable: true, soundsEnabled: true });
    emitCadOpened();
  };

  if (!isEnvBrowser()) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        'z-index': '9999',
      }}
    >
      <button
        onClick={openCad}
        style={{
          padding: '12px 24px',
          'background-color': '#c0c0c0',
          color: '#000',
          border: '2px solid #fff',
          'font-family': 'monospace',
          'font-size': '14px',
          cursor: 'pointer',
          'box-shadow': '4px 4px 0 #000',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#fff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#c0c0c0';
        }}
      >
        [ OPEN CAD + BOOT ]
      </button>
      <button
        onClick={openCadWithoutCallsign}
        style={{
          'margin-top': '8px',
          padding: '10px 24px',
          'background-color': '#2a3743',
          color: '#dcefff',
          border: '2px solid #7db8dd',
          'font-family': 'monospace',
          'font-size': '12px',
          cursor: 'pointer',
          'box-shadow': '4px 4px 0 #000',
        }}
      >
        [ BOOT + CALLSIGN SETUP ]
      </button>
      <div
        style={{
          'margin-top': '8px',
          'text-align': 'center',
          color: '#fff',
          'font-family': 'monospace',
          'font-size': '10px',
          'text-shadow': '1px 1px 0 #000',
        }}
      >
        Dev Mode
      </div>
    </div>
  );
}
