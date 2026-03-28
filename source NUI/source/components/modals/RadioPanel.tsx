
import { createSignal, createMemo, For, Show, onMount } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { radioState, radioActions } from '~/stores/radioStore';
import { cadState, cadActions } from '~/stores/cadStore';
import { userActions } from '~/stores/userStore';
import { playPTTStart, playPTTEnd } from '~/utils/sounds';
import type { RadioMessage } from '~/stores/radioStore';
import type { RadioMarker } from '~/stores/cadStore';
import { Button, Input, Modal, Tabs } from '~/components/ui';

export function RadioPanel() {
  const [activeTab, setActiveTab] = createSignal<'channels' | 'users' | 'messages' | 'chatter'>('channels');
  const [newChannelName, setNewChannelName] = createSignal('');
  const [newChannelPassword, setNewChannelPassword] = createSignal('');
  const [messageText, setMessageText] = createSignal('');
  const [isTalking, setIsTalking] = createSignal(false);
  const [frequency, setFrequency] = createSignal(100.0);

  const frequencyMap: Record<number, string> = {
    100.0: 'CH-1',
    150.5: 'CH-2',
    200.0: 'CH-3',
    250.5: 'CH-4',
    300.0: 'CH-5',
    350.5: 'CH-6',
  };
  
  onMount(() => {
    radioActions.setCurrentUser({
      userId: 'USER_' + Date.now(),
      name: 'Oficial Demo',
      badge: 'B-001',
      department: 'POLICE',
      currentChannel: '',
      isTalking: false,
      isMuted: false,
      isDeafened: false,
      joinedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    });
  });
  
  const fixedChannels = createMemo(() => 
    Object.values(radioState.channels).filter(c => c.type === 'FIXED')
  );
  
  const tempChannels = createMemo(() => 
    Object.values(radioState.channels).filter(c => c.type === 'TEMPORARY')
      .sort((a, b) => new Date(a.expiresAt || '').getTime() - new Date(b.expiresAt || '').getTime())
  );
  
  const currentChannelUsers = createMemo(() => {
    if (!radioState.currentChannel) return [];
    return radioActions.getUsersInChannel(radioState.currentChannel);
  });
  
  const channelMessages = createMemo(() => {
    if (!radioState.currentChannel) return [];
    return radioActions.getChannelMessages(radioState.currentChannel, 20);
  });
  
  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };
  
  const createTempChannel = () => {
    if (!newChannelName().trim()) return;
    const channelId = radioActions.createTempChannel(
      newChannelName(),
      newChannelPassword() || undefined
    );
    if (channelId) {
      setNewChannelName('');
      setNewChannelPassword('');
    }
  };
  
  const sendMessage = () => {
    if (!messageText().trim()) return;
    radioActions.sendMessage(messageText());
    setMessageText('');
  };
  
  const startTalk = () => {
    if (!radioState.currentUser || isTalking()) return;
    setIsTalking(true);
    radioActions.setTalking(true);
    playPTTStart();
  };

  const stopTalk = () => {
    if (!isTalking()) return;
    setIsTalking(false);
    radioActions.setTalking(false);
    playPTTEnd();
  };

  const toggleTalk = () => {
    if (isTalking()) {
      stopTalk();
    } else {
      startTalk();
    }
  };
  
  const formatTimeLeft = (expiresAt?: string) => {
    if (!expiresAt) return '';
    const expires = new Date(expiresAt).getTime();
    const now = Date.now();
    const minutesLeft = Math.floor((expires - now) / (1000 * 60));
    if (minutesLeft < 0) return 'Expirado';
    if (minutesLeft < 60) return `${minutesLeft}m`;
    return `${Math.floor(minutesLeft / 60)}h ${minutesLeft % 60}m`;
  };

  const markMessage = (msg: RadioMessage) => {
    const marker: RadioMarker = {
      markerId: `MARKER_${Date.now()}`,
      message: msg.content,
      sender: msg.senderName,
      channel: radioState.currentChannel || 'Unknown',
      timestamp: msg.timestamp,
      markedBy: userActions.getCurrentUserId(),
      markedAt: new Date().toISOString(),
      notes: '',
    };
    
    if (cadState.currentCase) {
      marker.linkedCaseId = cadState.currentCase.caseId;
    }
    
    cadActions.addRadioMarker(marker);
    terminalActions.addLine(`Message marked: ${marker.markerId.substring(0, 12)}`, 'system');
  };

  const viewMarkers = () => {
    terminalActions.setActiveModal('RADIO_MARKERS');
  };
  
  return (
    <Modal.Root onClose={closeModal} contentClass='radio-panel'>
      <Modal.Header>
        <Modal.Title>📻 PANEL DE RADIO</Modal.Title>
        <Modal.Close />
      </Modal.Header>

      <Tabs.Root
        value={activeTab()}
        onValueChange={(value) => setActiveTab(value as 'channels' | 'users' | 'messages' | 'chatter')}
        bracketed={false}
        uppercase={false}
      >
        <Tabs.List>
          <Tabs.Trigger value='channels' label='📡 Canales' />
          <Tabs.Trigger value='users' label='👥 Usuarios' />
          <Tabs.Trigger value='messages' label='💬 Mensajes' />
          <Tabs.Trigger value='chatter' label='📻 Chatter' />
        </Tabs.List>
      </Tabs.Root>
        
        <div class="modal-body">
          <Show when={activeTab() === 'channels'}>
            <div class="radio-section">
              <div class="section-header">
                <h3>CANAL ACTUAL</h3>
                <Show when={radioState?.currentChannel}>
                  <div class="current-channel">
                    <span class="badge">CANAL ACTUAL</span>
                    <strong>{radioState?.currentChannel} [{radioState?.channels?.[radioState?.currentChannel!]?.name}]</strong>
                  </div>
                </Show>
              </div>
              
              <div class="radio-controls">
                <button 
                  class={`btn ${isTalking() ? 'btn-danger' : 'btn-success'}`}
                  onMouseDown={startTalk}
                  onMouseUp={stopTalk}
                  onMouseLeave={stopTalk}
                  onTouchStart={startTalk}
                  onTouchEnd={toggleTalk}
                  disabled={!radioState.currentUser}
                >
                  {isTalking() ? '🎤 HABLANDO' : '🎤 PTT'}
                </button>
                <button 
                  class={`btn ${radioState?.isMuted ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => radioActions.toggleMute()}
                  disabled={!radioState.currentUser}
                >
                  {radioState?.isMuted ? '🔇 Muteado' : '🔊 Sonido'}
                </button>
                <Button.Root 
                  class="btn btn-secondary"
                  onClick={() => radioActions.setVolume(Math.min(100, radioState.volume + 10))}
                >
                  🔊 Vol + ({radioState.volume}%)
                </Button.Root>
                <Button.Root 
                  class="btn btn-secondary"
                  onClick={() => radioActions.setVolume(Math.max(0, radioState.volume - 10))}
                >
                  🔉 Vol -
                </Button.Root>
              </div>
              
              <div class="frequency-selector">
                <h4>📡 SELECTOR DE FRECUENCIA</h4>
                <div class="frequency-display">
                  <span class="freq-value">{frequency().toFixed(1)}</span>
                  <span class="freq-unit">MHz</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="350"
                  step="0.5"
                  value={frequency()}
                  onInput={(e) => {
                    const freq = Number(e.currentTarget.value);
                    setFrequency(freq);
                    const channelId = frequencyMap[freq];
                    if (channelId) {
                      radioActions.joinChannel(channelId);
                    }
                  }}
                  class="frequency-slider dos-slider"
                />
                <div class="frequency-markers">
                  <For each={Object.entries(frequencyMap)}>
                    {([freq, ch]) => (
                      <div 
                        class={`freq-marker ${radioState.currentChannel === ch ? 'active' : ''}`}
                        onClick={() => {
                          setFrequency(Number(freq));
                          radioActions.joinChannel(ch);
                        }}
                      >
                        <span class="marker-freq">{freq} MHz</span>
                        <span class="marker-ch">{ch}</span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
              
              <div class="section-header">
                <h3>CANALES FIJOS</h3>
              </div>
              <div class="channels-list">
                <For each={fixedChannels()}>
                  {(channel) => (
                    <div class={`channel-item ${radioState.currentChannel === channel.channelId ? 'active' : ''}`}>
                      <div class="channel-info">
                        <strong>{channel.channelId}</strong>
                        <span>{channel.name}</span>
                        <small>{channel.description}</small>
                      </div>
                      <div class="channel-users-count">
                        👤 {radioActions.getUsersInChannel(channel.channelId).length}
                      </div>
                      <Show when={radioState?.currentChannel !== channel?.channelId}>
                        <Button.Root 
                          class="btn btn-small"
                          onClick={() => channel?.channelId && radioActions?.joinChannel?.(channel.channelId)}
                          disabled={!radioState?.currentUser}
                        >
                          Unirse
                        </Button.Root>
                      </Show>
                      <Show when={radioState?.currentChannel === channel?.channelId}>
                        <span class="badge">ACTUAL</span>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
              
              <Show when={tempChannels().length > 0}>
                <div class="section-header">
                  <h3>CANALES TEMPORALES</h3>
                </div>
                <div class="channels-list">
                  <For each={tempChannels()}>
                    {(channel) => (
                      <div class={`channel-item temporary ${radioState.currentChannel === channel.channelId ? 'active' : ''}`}>
                        <div class="channel-info">
                          <strong>{channel.channelId}</strong>
                          <span>{channel.name}</span>
                          <small>Expira: {formatTimeLeft(channel.expiresAt)}</small>
                        </div>
                        <div class="channel-users-count">
                          👤 {radioActions.getUsersInChannel(channel.channelId).length}
                        </div>
                        <Show when={radioState.currentChannel !== channel.channelId}>
                          <Button.Root 
                            class="btn btn-small"
                            onClick={() => radioActions.joinChannel(channel.channelId, channel.password)}
                          >
                            Unirse
                          </Button.Root>
                        </Show>
                        <Show when={radioState.currentChannel === channel.channelId}>
                          <span class="badge">ACTUAL</span>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              
              <div class="section-header">
                <h3>CREAR CANAL TEMPORAL</h3>
              </div>
              <div class="create-channel-form">
                <Input.Root
                  type="text"
                  class="dos-input"
                  value={newChannelName()}
                  onInput={(e) => setNewChannelName(e.currentTarget.value)}
                  placeholder="Nombre del canal"
                  maxlength={20}
                />
                <Input.Root
                  type="password"
                  class="dos-input"
                  value={newChannelPassword()}
                  onInput={(e) => setNewChannelPassword(e.currentTarget.value)}
                  placeholder="Contraseña (opcional)"
                />
                <Button.Root class="btn btn-primary" onClick={createTempChannel}>
                  ➕ Crear Canal
                </Button.Root>
              </div>
            </div>
          </Show>
          
          <Show when={activeTab() === 'users'}>
            <div class="radio-section">
              <div class="section-header">
                <h3>USUARIOS EN {radioState.currentChannel || 'NINGUN CANAL'}</h3>
              </div>
              <Show when={radioState.currentChannel}>
                <div class="users-list">
                  <For each={currentChannelUsers()}>
                    {(user) => (
                      <div class={`user-item ${user?.isTalking ? 'talking' : ''}`}>
                        <div class="user-status">
                          {user?.isTalking && <span class="talking-indicator">🎤</span>}
                          {user?.isMuted && <span>🔇</span>}
                          {user?.isDeafened && <span>🙉</span>}
                        </div>
                        <div class="user-info">
                          <strong>{user.name}</strong>
                          <span>{user.badge}</span>
                          <small>{user.department}</small>
                        </div>
                        <Show when={user.userId === radioState.currentUser?.userId}>
                          <span class="badge">YO</span>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={!radioState.currentChannel}>
                <p class="empty-message">No estás en ningún canal</p>
              </Show>
            </div>
          </Show>
          
          <Show when={activeTab() === 'messages'}>
            <div class="radio-section">
              <div class="section-header">
                <h3>MENSAJES - {radioState.currentChannel || 'SELECCIONA UN CANAL'}</h3>
                <Button.Root class="btn btn-small" onClick={viewMarkers}>
                  📌 Ver Marcadores
                </Button.Root>
              </div>
              <Show when={radioState.currentChannel}>
                <div class="messages-list">
                  <For each={channelMessages()}>
                    {(msg) => (
                      <div class={`message-item ${msg.type === 'EMERGENCY' ? 'emergency' : ''}`}>
                        <div class="message-header">
                          <strong>{msg.senderName}</strong>
                          <span>{msg.senderBadge}</span>
                          <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
                          <Button.Root 
                            class="btn-mark" 
                            onClick={() => markMessage(msg)}
                            title="Marcar mensaje importante"
                          >
                            📌
                          </Button.Root>
                        </div>
                        <div class="message-content">{msg.content}</div>
                      </div>
                    )}
                  </For>
                </div>
                <div class="message-input">
                  <input
                    type="text"
                    value={messageText()}
                    onInput={(e) => setMessageText(e.currentTarget.value)}
                    placeholder="Escribir mensaje..."
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <Button.Root class="btn btn-primary" onClick={sendMessage}>
                    📤 Enviar
                  </Button.Root>
                </div>
              </Show>
              <Show when={!radioState.currentChannel}>
                <p class="empty-message">Únete a un canal para ver mensajes</p>
              </Show>
            </div>
          </Show>

          <Show when={activeTab() === 'chatter'}>
            <div class="radio-section">
              <div class="section-header">
                <h3>📻 RADIO CHATTER</h3>
                <div class="chatter-controls">
                  <button 
                    class={`btn btn-small ${radioState.chatterEnabled ? 'btn-success' : 'btn-danger'}`}
                    onClick={() => radioActions.toggleChatter()}
                  >
                    {radioState.chatterEnabled ? '⏸️ Pausar' : '▶️ Reanudar'}
                  </button>
                  <Button.Root class="btn btn-small" onClick={() => radioActions.clearChatter()}>
                    🗑️ Limpiar
                  </Button.Root>
                </div>
              </div>
              
              <div class="chatter-volume">
                <label>Volumen: {radioState.chatterVolume}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={radioState.chatterVolume}
                  onInput={(e) => radioActions.setChatterVolume(Number(e.currentTarget.value))}
                  class="volume-slider dos-slider"
                />
              </div>

              <div class="chatter-list">
                <Show when={radioState.recentChatter.length === 0}>
                  <p class="empty-message">El chatter comenzará pronto...</p>
                </Show>
                <For each={radioState.recentChatter}>
                  {(chatter) => (
                    <div class={`chatter-item ${chatter.type}`}>
                      <div class="chatter-header">
                        <span class="chatter-unit">{chatter.unit}</span>
                        <span class="chatter-time">
                          {new Date(chatter.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div class="chatter-message">{chatter.message}</div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
    </Modal.Root>
  );
}
