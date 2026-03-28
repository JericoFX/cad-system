
import { createCommand } from '../commandBuilder';
import { radioState, radioActions } from '~/stores/radioStore';

export function registerRadioCommands(): void {
  createCommand({
    name: 'radio',
    description: 'Abrir panel de radio (GUI)',
    usage: 'radio',
    category: 'COMMS',
    handler: async ({ terminal }) => {
      terminal.print('📻 Abriendo panel de radio...', 'system');
      terminal.openModal('RADIO_PANEL');
    }
  });
  
  createCommand({
    name: 'radio-cli',
    description: 'Panel de radio modo CLI interactivo',
    usage: 'radio-cli',
    category: 'COMMS',
    handler: async ({ terminal }) => {
      terminal.print('📻 PANEL DE RADIO - MODO CLI', 'system');
      terminal.print('═══════════════════════════════', 'system');
      
      const action = await terminal.select('Selecciona acción:', [
        'join - Unirse a canal',
        'leave - Salir del canal',
        'create - Crear canal temporal',
        'list - Ver canales disponibles',
        'status - Estado actual',
        'volume - Ajustar volumen'
      ]);
      
      const actionType = action.split(' - ')[0];
      
      switch (actionType) {
        case 'join': {
          const channelType = await terminal.select('Tipo de canal:', ['Fijo', 'Temporal']);
          
          if (channelType === 'Fijo') {
            const channel = await terminal.select('Selecciona canal:', [
              'CH-1 - DISPATCH',
              'CH-2 - POLICE', 
              'CH-3 - EMS',
              'CH-4 - TÁCTICO',
              'CH-5 - COMBINED',
              'CH-6 - NEWS'
            ]);
            const channelId = channel.split(' - ')[0];
            const success = radioActions.joinChannel(channelId);
            if (success) {
              terminal.print(`✓ Conectado a ${channelId}`, 'success');
            } else {
              terminal.print('✗ No se pudo conectar', 'error');
            }
          } else {
            const tempChannel = await terminal.prompt('ID del canal temporal (TMP-XXXX):');
            const password = await terminal.prompt('Contraseña (opcional):');
            const success = radioActions.joinChannel(tempChannel, password || undefined);
            if (success) {
              terminal.print(`✓ Conectado a ${tempChannel}`, 'success');
            } else {
              terminal.print('✗ Canal no encontrado o contraseña incorrecta', 'error');
            }
          }
          break;
        }
        
        case 'leave': {
          const currentChannel = radioState.currentChannel;
          if (currentChannel) {
            radioActions.leaveChannel(currentChannel);
            terminal.print(`✓ Desconectado de ${currentChannel}`, 'success');
          } else {
            terminal.print('No estás en ningún canal', 'warning');
          }
          break;
        }
        
        case 'create': {
          const name = await terminal.prompt('Nombre del canal:');
          if (!name) {
            terminal.print('✗ Nombre requerido', 'error');
            return;
          }
          const password = await terminal.prompt('Contraseña (opcional):');
          const usePassword = password ? await terminal.confirm('¿Usar contraseña?') : false;
          
          const channelId = radioActions.createTempChannel(
            name,
            usePassword ? password : undefined
          );
          
          if (channelId) {
            terminal.print(`✓ Canal creado: ${channelId}`, 'success');
            terminal.print(`  Nombre: ${name}`, 'info');
            terminal.print(`  Expira en 30 minutos`, 'info');
          } else {
            terminal.print('✗ No se pudo crear el canal (límite alcanzado)', 'error');
          }
          break;
        }
        
        case 'list': {
          const channels = Object.values(radioState.channels);
          terminal.print('\n📡 CANALES DISPONIBLES:', 'system');
          terminal.print('═══════════════════════════════', 'system');
          
          channels.forEach((ch: any) => {
            const users = radioActions.getUsersInChannel(ch.channelId).length;
            const status = ch.type === 'FIXED' ? '📡' : '⏱️';
            terminal.print(`${status} ${ch.channelId} - ${ch.name} (${users} usuarios)`, 'info');
          });
          break;
        }
        
        case 'status': {
          const current = radioState.currentChannel;
          const users = current ? radioActions.getUsersInChannel(current).length : 0;
          terminal.print('\n📻 ESTADO ACTUAL:', 'system');
          terminal.print(`Canal: ${current || 'Ninguno'}`, 'info');
          terminal.print(`Usuarios: ${users}`, 'info');
          terminal.print(`Volumen: ${radioState.volume}%`, 'info');
          terminal.print(`Mute: ${radioState.isMuted ? 'Sí' : 'No'}`, 'info');
          break;
        }
        
        case 'volume': {
          const vol = await terminal.prompt('Nivel de volumen (0-100):');
          const volume = parseInt(vol);
          if (!isNaN(volume) && volume >= 0 && volume <= 100) {
            radioActions.setVolume(volume);
            terminal.print(`✓ Volumen ajustado a ${volume}%`, 'success');
          } else {
            terminal.print('✗ Valor inválido', 'error');
          }
          break;
        }
      }
    }
  });
  
  createCommand({
    name: 'radio-join',
    description: 'Unirse a canal de radio (rápido)',
    usage: 'radio-join [canal]',
    category: 'COMMS',
    args: [
      { name: 'channel', type: 'string', required: true, description: 'ID del canal' }
    ],
    handler: async ({ args, terminal }) => {
      const success = radioActions.joinChannel(args.channel);
      if (success) {
        terminal.print(`✓ Conectado a ${args.channel}`, 'success');
      } else {
        terminal.print(`✗ No se pudo conectar a ${args.channel}`, 'error');
      }
    }
  });
}
