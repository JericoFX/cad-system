
import { createStore } from 'solid-js/store';
import { batch } from 'solid-js';
import { fetchNui } from '~/utils/fetchNui';

export type RadioChannelType = 'FIXED' | 'TEMPORARY';
export type RadioDepartment = 'POLICE' | 'EMS' | 'DISPATCH' | 'NEWS' | 'ADMIN';

export interface RadioChannel {
  channelId: string;
  type: RadioChannelType;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  expiresAt?: string;
  password?: string;
  isEncrypted?: boolean;
}

export interface RadioUser {
  userId: string;
  name: string;
  badge: string;
  department: RadioDepartment;
  currentChannel: string;
  isTalking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  joinedAt: string;
  lastActivity: string;
}

export interface RadioMessage {
  messageId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderBadge: string;
  content: string;
  timestamp: string;
  type: 'VOICE' | 'TEXT' | 'EMERGENCY';
}

export interface RadioState {
  channels: Record<string, RadioChannel>;
  users: Record<string, RadioUser>;
  messages: RadioMessage[];
  currentUser: RadioUser | null;
  currentChannel: string | null;
  isConnected: boolean;
  volume: number;
  isMuted: boolean;
  chatterEnabled: boolean;
  chatterVolume: number;
  recentChatter: RadioChatter[];
}

export interface RadioChatter {
  id: string;
  message: string;
  unit: string;
  timestamp: number;
  type: 'dispatch' | 'unit' | 'emergency';
}

const FIXED_CHANNELS: RadioChannel[] = [
  {
    channelId: 'CH-1',
    type: 'FIXED',
    name: 'DISPATCH',
    description: 'Central de comunicaciones',
    createdAt: new Date().toISOString()
  },
  {
    channelId: 'CH-2',
    type: 'FIXED',
    name: 'POLICE',
    description: 'Todos los oficiales',
    createdAt: new Date().toISOString()
  },
  {
    channelId: 'CH-3',
    type: 'FIXED',
    name: 'EMS',
    description: 'Todos los paramédicos',
    createdAt: new Date().toISOString()
  },
  {
    channelId: 'CH-4',
    type: 'FIXED',
    name: 'TÁCTICO',
    description: 'SWAT y operativos especiales',
    createdAt: new Date().toISOString()
  },
  {
    channelId: 'CH-5',
    type: 'FIXED',
    name: 'COMBINED',
    description: 'Multi-agencia: PD+EMS+Dispatch',
    createdAt: new Date().toISOString()
  },
  {
    channelId: 'CH-6',
    type: 'FIXED',
    name: 'NEWS',
    description: 'Canal de prensa',
    createdAt: new Date().toISOString()
  }
];

const initialState: RadioState = {
  channels: {},
  users: {},
  messages: [],
  currentUser: null,
  currentChannel: null,
  isConnected: false,
  volume: 80,
  isMuted: false,
  chatterEnabled: true,
  chatterVolume: 30,
  recentChatter: []
};

export const [radioState, setRadioState] = createStore<RadioState>(initialState);

FIXED_CHANNELS.forEach(channel => {
  setRadioState('channels', channel.channelId, channel);
});

function generateTempChannelId(): string {
  const chars = '0123456789';
  let code = 'TMP-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function cleanupExpiredChannels() {
  const now = new Date().toISOString();
  Object.values(radioState.channels).forEach(channel => {
    if (channel.type === 'TEMPORARY' && channel.expiresAt && channel.expiresAt < now) {
      Object.values(radioState.users).forEach(user => {
        if (user.currentChannel === channel.channelId) {
          setRadioState('users', user.userId, 'currentChannel', 'CH-2');
        }
      });
      setRadioState('channels', channel.channelId, undefined as any);
    }
  });
}

setInterval(() => {
  if (typeof document !== 'undefined' && document.hidden) {
    return;
  }

  const hasTemporaryChannels = Object.values(radioState.channels).some(
    (channel) => channel.type === 'TEMPORARY'
  );

  if (!hasTemporaryChannels) {
    return;
  }

  cleanupExpiredChannels();
}, 60000);

export const radioActions = {
  setCurrentUser(user: RadioUser) {
    setRadioState('currentUser', user);
    setRadioState('isConnected', true);
  },
  
  joinChannel(channelId: string, password?: string): boolean {
    const channel = radioState.channels[channelId];
    if (!channel) {
      console.error(`[Radio] Channel not found: ${channelId}`);
      return false;
    }
    
    if (channel.password && channel.password !== password) {
      console.error('[Radio] Invalid password');
      return false;
    }
    
    const userId = radioState.currentUser?.userId;
    if (!userId) {
      console.error('[Radio] No current user');
      return false;
    }
    
    if (radioState.currentChannel) {
      this.leaveChannel(radioState.currentChannel);
    }
    
    setRadioState('currentChannel', channelId);
    setRadioState('users', userId, {
      ...radioState.currentUser!,
      currentChannel: channelId,
      joinedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    });
    
    this.emitRadioEvent('user_joined', { userId, channelId });
    
    return true;
  },
  
  leaveChannel(channelId: string) {
    const userId = radioState.currentUser?.userId;
    if (!userId) return;
    
    setRadioState('users', userId, 'currentChannel', '');
    
    const channel = radioState.channels[channelId];
    if (channel?.type === 'TEMPORARY') {
      const usersInChannel = Object.values(radioState.users).filter(
        u => u.currentChannel === channelId
      );
      if (usersInChannel.length === 0) {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);
        setRadioState('channels', channelId, 'expiresAt', expiresAt.toISOString());
      }
    }
    
    this.emitRadioEvent('user_left', { userId, channelId });
  },
  
  createTempChannel(name: string, password?: string, encrypted: boolean = false): string | null {
    const userId = radioState.currentUser?.userId;
    if (!userId) return null;
    
    const userCreatedChannels = Object.values(radioState.channels).filter(
      c => c.type === 'TEMPORARY' && c.createdBy === userId
    );
    if (userCreatedChannels.length >= 3) {
      console.error('[Radio] User has reached temporary channel limit');
      return null;
    }
    
    const channelId = generateTempChannelId();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
    
    const channel: RadioChannel = {
      channelId,
      type: 'TEMPORARY',
      name: name.substring(0, 20),
      createdBy: userId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      password,
      isEncrypted: encrypted
    };
    
    setRadioState('channels', channelId, channel);
    
    this.joinChannel(channelId, password);
    
    this.emitRadioEvent('channel_created', { channelId, createdBy: userId });
    
    return channelId;
  },
  
  closeTempChannel(channelId: string): boolean {
    const channel = radioState.channels[channelId];
    if (!channel || channel.type !== 'TEMPORARY') return false;
    
    const userId = radioState.currentUser?.userId;
    if (channel.createdBy !== userId && !this.isAdmin()) return false;
    
    Object.values(radioState.users).forEach(user => {
      if (user.currentChannel === channelId) {
        setRadioState('users', user.userId, 'currentChannel', 'CH-2');
      }
    });
    
    setRadioState('channels', channelId, undefined as any);
    
    this.emitRadioEvent('channel_closed', { channelId, closedBy: userId });
    
    return true;
  },
  
  sendMessage(content: string, type: RadioMessage['type'] = 'TEXT') {
    const channelId = radioState.currentChannel;
    if (!channelId) {
      console.error('[Radio] Not in any channel');
      return;
    }
    
    const user = radioState.currentUser;
    if (!user) return;
    
    const message: RadioMessage = {
      messageId: `MSG_${Date.now()}`,
      channelId,
      senderId: user.userId,
      senderName: user.name,
      senderBadge: user.badge,
      content: content.substring(0, 500),
      timestamp: new Date().toISOString(),
      type
    };
    
    setRadioState('messages', messages => [...messages.slice(-100), message]);
    
    setRadioState('users', user.userId, 'lastActivity', new Date().toISOString());
    
    this.emitRadioEvent('message', message);
  },

  injectSystemMessage(
    channelId: string,
    content: string,
    type: RadioMessage['type'] = 'TEXT',
    senderName: string = 'DISPATCH',
    senderBadge: string = 'DSP'
  ) {
    if (!channelId || !radioState.channels[channelId]) {
      return;
    }

    const message: RadioMessage = {
      messageId: `SYS_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      channelId,
      senderId: 'SYSTEM',
      senderName,
      senderBadge,
      content: content.substring(0, 500),
      timestamp: new Date().toISOString(),
      type,
    };

    batch(() => {
      setRadioState('messages', messages => [...messages.slice(-100), message]);
    });
    this.emitRadioEvent('message', message);
  },

  injectSystemMessageToChannels(
    channelIds: string[],
    content: string,
    type: RadioMessage['type'] = 'TEXT',
    senderName: string = 'DISPATCH',
    senderBadge: string = 'DSP'
  ) {
    if (!channelIds || channelIds.length === 0) {
      return;
    }

    const messages: RadioMessage[] = [];
    const now = new Date().toISOString();

    channelIds.forEach(channelId => {
      if (!radioState.channels[channelId]) {
        return;
      }

      messages.push({
        messageId: `SYS_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        channelId,
        senderId: 'SYSTEM',
        senderName,
        senderBadge,
        content: content.substring(0, 500),
        timestamp: now,
        type,
      });
    });

    if (messages.length === 0) {
      return;
    }

    batch(() => {
      messages.forEach(message => {
        setRadioState('messages', msgs => [...msgs.slice(-100), message]);
        this.emitRadioEvent('message', message);
      });
    });
  },
  
  setTalking(isTalking: boolean) {
    const userId = radioState.currentUser?.userId;
    if (!userId) return;
    
    setRadioState('users', userId, 'isTalking', isTalking);
    
    if (isTalking) {
      setRadioState('users', userId, 'lastActivity', new Date().toISOString());
    }
  },
  
  toggleMute() {
    const userId = radioState.currentUser?.userId;
    if (!userId) return;
    
    const currentMute = radioState.users[userId]?.isMuted || false;
    setRadioState('users', userId, 'isMuted', !currentMute);
    setRadioState('isMuted', !currentMute);
  },
  
  toggleDeafen() {
    const userId = radioState.currentUser?.userId;
    if (!userId) return;
    
    const currentDeafen = radioState.users[userId]?.isDeafened || false;
    setRadioState('users', userId, 'isDeafened', !currentDeafen);
  },
  
  setVolume(volume: number) {
    setRadioState('volume', Math.max(0, Math.min(100, volume)));
  },
  
  getUsersInChannel(channelId: string): RadioUser[] {
    return Object.values(radioState.users).filter(
      user => user.currentChannel === channelId
    );
  },
  
  getChannelMessages(channelId: string, limit: number = 50): RadioMessage[] {
    return radioState.messages
      .filter(msg => msg.channelId === channelId)
      .slice(-limit);
  },
  
  isAdmin(): boolean {
    const user = radioState.currentUser;
    if (!user) return false;
    if (user.department === 'ADMIN') return true;
    if (user.badge && user.badge.startsWith('ADM')) return true;
    return false;
  },
  
  emitRadioEvent(event: string, data: any) {
    window.dispatchEvent(new CustomEvent(`radio:${event}`, { detail: data }));
    
    if (typeof window !== 'undefined') {
      fetchNui(`cad:radio:${event}`, data).catch(console.error);
    }
  },
  
  disconnect() {
    const userId = radioState.currentUser?.userId;
    if (userId && radioState.currentChannel) {
      this.leaveChannel(radioState.currentChannel);
    }
    setRadioState('currentUser', null);
    setRadioState('currentChannel', null);
    setRadioState('isConnected', false);
  },

  // Radio Chatter Simulation
  toggleChatter() {
    setRadioState('chatterEnabled', !radioState.chatterEnabled);
    if (radioState.chatterEnabled) {
      this.startChatter();
    } else {
      this.stopChatter();
    }
  },

  setChatterVolume(volume: number) {
    setRadioState('chatterVolume', Math.max(0, Math.min(100, volume)));
  },

  addChatter(message: string, unit: string, type: RadioChatter['type'] = 'dispatch') {
    const chatter: RadioChatter = {
      id: `chatter-${Date.now()}`,
      message,
      unit,
      timestamp: Date.now(),
      type
    };
    setRadioState('recentChatter', prev => [chatter, ...prev].slice(0, 50));
  },

  clearChatter() {
    setRadioState('recentChatter', []);
  },

  startChatter() {
    if (!radioState.chatterEnabled) return;

    const phrases = {
      dispatch: [
        'Dispatch to all units, 10-4 on that last call.',
        'Be advised, we have multiple units en route.',
        'Dispatch copies, continue on your current assignment.',
        'All units, signal 100, maintain radio silence.',
        'Dispatch to available units, priority call in progress.',
        'Be on the lookout for suspect vehicle, last seen heading north.',
        'Dispatch confirming 10-97 at your location.',
        'Attention all units, signal 60 in effect.',
        'Dispatch to unit, confirm your 10-20.',
        'All available units, respond to priority one.'
      ],
      unit: [
        'Unit 12, 10-8 and available.',
        '10-4 Dispatch, unit is 10-97.',
        'Unit 5 requesting backup at current location.',
        'This is unit 8, show me 10-6 on that traffic stop.',
        'Unit 3, 10-41 on the suspect.',
        '10-9 Dispatch, repeat last transmission.',
        'Unit 7, 10-23, scene is secure.',
        'Unit 2 requesting 10-32, code 3.',
        'This is unit 4, 10-96 on the subject.',
        'Unit 9, 10-15 with one in custody.'
      ],
      emergency: [
        'Signal 13! Officer needs assistance!',
        'All units, 10-33, emergency traffic only.',
        'Code 99, officer in trouble!',
        'Priority 1, shots fired!',
        'All units, 10-64, officer down!'
      ]
    };

    const scheduleNextChatter = () => {
      if (!radioState.chatterEnabled) return;
      
      const delay = Math.random() * 40000 + 20000; // 20-60 seconds
      setTimeout(() => {
        if (!radioState.chatterEnabled) return;
        
        const isEmergency = Math.random() > 0.95;
        const type = isEmergency ? 'emergency' : (Math.random() > 0.5 ? 'dispatch' : 'unit');
        const messages = phrases[type];
        const message = messages[Math.floor(Math.random() * messages.length)];
        const unit = type === 'dispatch' ? 'DISPATCH' : `UNIT-${Math.floor(Math.random() * 20) + 1}`;
        
        this.addChatter(message, unit, type);
        
        // Also add as system message if connected
        if (radioState.currentChannel && radioState.isConnected) {
          this.injectSystemMessage(
            radioState.currentChannel,
            `[${unit}] ${message}`,
            type === 'emergency' ? 'EMERGENCY' : 'TEXT',
            unit,
            type === 'dispatch' ? 'DSP' : 'UNIT'
          );
        }
        
        scheduleNextChatter();
      }, delay);
    };

    scheduleNextChatter();
  },

  stopChatter() {
    // Chatter stops on next cycle check
  }
};

// Auto-start radio chatter on import
if (typeof window !== 'undefined') {
  setTimeout(() => radioActions.startChatter(), 5000);
}
