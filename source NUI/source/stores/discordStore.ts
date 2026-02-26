
import { createStore } from 'solid-js/store';

export type DiscordEvent = 
  | 'EMERGENCY_ALERT'
  | 'ARREST_REGISTERED'
  | 'WARRANT_ISSUED'
  | 'NEWS_PUBLISHED'
  | 'OFFICER_STATUS'
  | 'DISPATCH_CALL'
  | 'RADIO_EMERGENCY';

export interface DiscordWebhookConfig {
  webhookUrl: string;
  enabledEvents: DiscordEvent[];
  messageStyle: 'DOS_PLAIN' | 'DOS_BOX';
  includeTimestamp: boolean;
  includeOfficerBadge: boolean;
  serverName: string;
}

export interface DiscordState {
  config: DiscordWebhookConfig | null;
  lastMessage: string | null;
  isEnabled: boolean;
  messageQueue: string[];
}

const initialState: DiscordState = {
  config: null,
  lastMessage: null,
  isEnabled: false,
  messageQueue: []
};

export const [discordState, setDiscordState] = createStore<DiscordState>(initialState);

function formatDOSBox(content: string, title: string): string {
  const lines = content.split('\n');
  const maxLength = Math.max(title.length, ...lines.map(l => l.length));
  const horizontalLine = '═'.repeat(maxLength + 4);
  
  let result = `╔${horizontalLine}╗\n`;
  result += `║ ${title.padEnd(maxLength + 2)} ║\n`;
  result += `╠${horizontalLine}╣\n`;
  
  lines.forEach(line => {
    result += `║ ${line.padEnd(maxLength + 2)} ║\n`;
  });
  
  result += `╚${horizontalLine}╝`;
  return result;
}

function formatDOSPlain(content: string, title: string): string {
  let result = `[C.A.D. SYSTEM - ${title}]\n`;
  result += '='.repeat(50) + '\n';
  result += content + '\n';
  result += '='.repeat(50);
  return result;
}

export const discordActions = {
  configure(config: DiscordWebhookConfig) {
    setDiscordState('config', config);
    setDiscordState('isEnabled', true);
  },
  
  isEventEnabled(event: DiscordEvent): boolean {
    return discordState.config?.enabledEvents.includes(event) || false;
  },
  
  sendEmergencyAlert(data: {
    code: string;
    description: string;
    location: string;
    unit: string;
    officerName: string;
    notes?: string;
  }) {
    if (!this.isEventEnabled('EMERGENCY_ALERT')) return;
    
    const content = `🚨 CÓDIGO: ${data.code}
📍 Ubicación: ${data.location}
⏰ Hora: ${new Date().toLocaleTimeString()}
👤 Unidad: ${data.unit} (${data.officerName})
📝 Notas: ${data.notes || 'N/A'}`;
    
    const message = discordState.config?.messageStyle === 'DOS_BOX'
      ? formatDOSBox(content, 'ALERTA DE EMERGENCIA')
      : formatDOSPlain(content, 'ALERTA');
    
    this.sendToDiscord(message);
  },
  
  sendArrest(data: {
    personName: string;
    citizenId: string;
    charges: string;
    officerName: string;
    officerBadge: string;
    station: string;
  }) {
    if (!this.isEventEnabled('ARREST_REGISTERED')) return;
    
    const content = `👤 Detenido: ${data.personName} (ID: ${data.citizenId})
⚖️ Cargos: ${data.charges}
👮 Oficial: ${data.officerName} (${data.officerBadge})
🏢 Estación: ${data.station}
📅 Fecha: ${new Date().toLocaleString()}`;
    
    const message = discordState.config?.messageStyle === 'DOS_BOX'
      ? formatDOSBox(content, 'REGISTRO DE ARRESTO')
      : formatDOSPlain(content, 'ARRESTO');
    
    this.sendToDiscord(message);
  },
  
  sendWarrant(data: {
    type: string;
    personName: string;
    citizenId: string;
    reason: string;
    issuedBy: string;
  }) {
    if (!this.isEventEnabled('WARRANT_ISSUED')) return;
    
    const content = `📋 Tipo: ${data.type}
👤 Persona: ${data.personName} (ID: ${data.citizenId})
📄 Razón: ${data.reason}
✍️ Emitida por: ${data.issuedBy}
📅 Fecha: ${new Date().toLocaleString()}`;
    
    const message = discordState.config?.messageStyle === 'DOS_BOX'
      ? formatDOSBox(content, 'ORDEN JUDICIAL EMITIDA')
      : formatDOSPlain(content, 'ORDEN JUDICIAL');
    
    this.sendToDiscord(message);
  },
  
  sendNews(data: {
    headline: string;
    author: string;
    category: string;
    shareCode: string;
  }) {
    if (!this.isEventEnabled('NEWS_PUBLISHED')) return;
    
    const content = `📰 Titular: ${data.headline}
✍️ Autor: ${data.author}
📋 Categoría: ${data.category}
🔗 Código: ${data.shareCode}
📅 Publicado: ${new Date().toLocaleString()}`;
    
    const message = discordState.config?.messageStyle === 'DOS_BOX'
      ? formatDOSBox(content, 'BOLETÍN DE PRENSA')
      : formatDOSPlain(content, 'NOTICIA');
    
    this.sendToDiscord(message);
  },
  
  sendOfficerStatus(data: {
    officerName: string;
    badge: string;
    oldStatus: string;
    newStatus: string;
    unit?: string;
  }) {
    if (!this.isEventEnabled('OFFICER_STATUS')) return;
    
    const content = `👤 Oficial: ${data.officerName} (${data.badge})
📊 Estado: ${data.oldStatus} → ${data.newStatus}
🚓 Unidad: ${data.unit || 'N/A'}
⏰ Hora: ${new Date().toLocaleTimeString()}`;
    
    const message = discordState.config?.messageStyle === 'DOS_BOX'
      ? formatDOSBox(content, 'CAMBIO DE ESTADO')
      : formatDOSPlain(content, 'ESTADO');
    
    this.sendToDiscord(message);
  },
  
  sendDispatchCall(data: {
    callId: string;
    type: string;
    priority: number;
    location: string;
    description: string;
  }) {
    if (!this.isEventEnabled('DISPATCH_CALL')) return;
    
    const priorityText = data.priority <= 2 ? '🔴 ALTA' : data.priority === 3 ? '🟡 MEDIA' : '🟢 BAJA';
    
    const content = `📞 ID: ${data.callId}
📋 Tipo: ${data.type}
🚨 Prioridad: ${priorityText}
📍 Ubicación: ${data.location}
📝 Descripción: ${data.description}
⏰ Hora: ${new Date().toLocaleTimeString()}`;
    
    const message = discordState.config?.messageStyle === 'DOS_BOX'
      ? formatDOSBox(content, 'NUEVA LLAMADA')
      : formatDOSPlain(content, 'DISPATCH');
    
    this.sendToDiscord(message);
  },
  
  sendRadioEmergency(data: {
    channelId: string;
    channelName: string;
    officerName: string;
    badge: string;
    message: string;
  }) {
    if (!this.isEventEnabled('RADIO_EMERGENCY')) return;
    
    const content = `📻 Canal: ${data.channelId} [${data.channelName}]
👤 Oficial: ${data.officerName} (${data.badge})
💬 Mensaje: ${data.message}
⏰ Hora: ${new Date().toLocaleTimeString()}`;
    
    const message = discordState.config?.messageStyle === 'DOS_BOX'
      ? formatDOSBox(content, 'EMERGENCIA DE RADIO')
      : formatDOSPlain(content, 'RADIO');
    
    this.sendToDiscord(message);
  },
  
  async sendToDiscord(message: string) {
    if (!discordState.config?.webhookUrl || !discordState.isEnabled) {
      setDiscordState('messageQueue', queue => [...queue, message]);
      return;
    }
    
    try {
      const response = await fetch(discordState.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message,
          username: 'C.A.D. System',
          avatar_url: 'https://i.imgur.com/police_icon.png'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      setDiscordState('lastMessage', message);
    } catch (error) {
      console.error('[Discord] Failed to send:', error);
      setDiscordState('messageQueue', queue => [...queue, message]);
    }
  },
  
  async processQueue() {
    if (!discordState.config?.webhookUrl || discordState.messageQueue.length === 0) return;
    
    const queue = [...discordState.messageQueue];
    setDiscordState('messageQueue', []);
    
    for (const message of queue) {
      await this.sendToDiscord(message);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    }
  },
  
  toggleEvent(event: DiscordEvent) {
    if (!discordState.config) return;
    
    const events = discordState.config.enabledEvents;
    if (events.includes(event)) {
      setDiscordState('config', 'enabledEvents', events.filter(e => e !== event));
    } else {
      setDiscordState('config', 'enabledEvents', [...events, event]);
    }
  },
  
  async testWebhook(): Promise<boolean> {
    const testMessage = discordState.config?.messageStyle === 'DOS_BOX'
      ? formatDOSBox('Conexión exitosa\nWebhook configurado correctamente', 'TEST')
      : formatDOSPlain('Conexión exitosa - Webhook configurado correctamente', 'TEST');
    
    try {
      await this.sendToDiscord(testMessage);
      return true;
    } catch {
      return false;
    }
  }
};
