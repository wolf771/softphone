<template>
  <div class="sip-phone">
    <div class="phone-body">
      <div class="phone-screen">
        <input v-model="phoneNumber" placeholder="Marca un número" :disabled="callInProgress || incomingCall" class="number-input" />
        <div class="status">{{ status }}</div>
      </div>
      <div v-if="reconnecting" class="reconnecting-indicator">
        <span>Reconectando</span>
        <span class="dots">{{ reconnectingDots }}</span>
      </div>
      
      <div class="dial-pad">
        <button v-for="digit in dialPad" :key="digit" @click="dial(digit)" :disabled="callInProgress || incomingCall" class="dial-button">
          {{ digit }}
        </button>
      </div>

      <div class="call-controls">
        <button @click="makeCall" :disabled="!phoneNumber || callInProgress || incomingCall || reconnecting" class="call-button">
          <font-awesome-icon icon="phone" size="lg" />
        </button>
        <button @click="hangUp" :disabled="!callInProgress && !incomingCall" class="hang-up-button">
          <font-awesome-icon icon="phone-slash" size="lg" />
        </button>
        <button @click="toggleHold" :disabled="!callInProgress || transferring" class="control-button">
          <font-awesome-icon :icon="onHold ? 'play' : 'pause'" size="lg" />
        </button>
        <button @click="initTransfer" :disabled="!callInProgress || onHold || transferring" class="control-button">
          <font-awesome-icon icon="share-square" size="lg" />
        </button>
      </div>

      <div class="transfer-section" v-if="transferring">
        <input v-model="transferNumber" placeholder="Número para transferir" class="transfer-input" />
        <button @click="completeTransfer" class="transfer-confirm">
          <font-awesome-icon icon="check" />
        </button>
        <button @click="cancelTransfer" class="transfer-cancel">
          <font-awesome-icon icon="times" />
        </button>
      </div>

      <div class="incoming-call" v-if="incomingCall && !callInProgress">
        <p>Llamada entrante de: {{ incomingCaller }}</p>
        <button @click="acceptCall" class="accept-button">
          <font-awesome-icon icon="phone" size="lg" />
        </button>
        <button @click="rejectCall" class="reject-button">
          <font-awesome-icon icon="phone-slash" size="lg" />
        </button>
      </div>
      <!-- Sección de historial de llamadas -->
      <div class="call-history">
        <div class="history-header">
          <h3>Historial de llamadas</h3>
          <button @click="clearCallHistory" class="clear-history-button" title="Limpiar historial" v-if="callHistory.length > 0">
            <font-awesome-icon icon="trash-alt" size="sm" />
          </button>
        </div>
        <div class="history-tabs">
          <button 
            @click="activeHistoryTab = 'all'" 
            :class="{ active: activeHistoryTab === 'all' }"
            class="history-tab-button"
          >
            Todas
          </button>
          <button 
            @click="activeHistoryTab = 'incoming'" 
            :class="{ active: activeHistoryTab === 'incoming' }"
            class="history-tab-button"
          >
            Recibidas
          </button>
          <button 
            @click="activeHistoryTab = 'outgoing'" 
            :class="{ active: activeHistoryTab === 'outgoing' }"
            class="history-tab-button"
          >
            Realizadas
          </button>
          <button 
            @click="activeHistoryTab = 'missed'" 
            :class="{ active: activeHistoryTab === 'missed' }"
            class="history-tab-button"
          >
            Perdidas
          </button>
        </div>
        <div class="history-list-container">
          <ul class="history-list" v-if="filteredCallHistory.length > 0">
            <li v-for="(call, index) in filteredCallHistory" :key="index" class="history-item" :class="call.type">
              <div class="call-icon">
                <font-awesome-icon 
                  :icon="getCallIcon(call.type)" 
                  :class="call.type" 
                  size="sm" 
                />
              </div>
              <div class="call-details">
                <div class="call-number">{{ call.number }}</div>
                <div class="call-time">{{ formatCallTime(call.timestamp) }}</div>
                <div class="call-duration" v-if="call.duration && call.type !== 'missed'">
                  {{ formatDuration(call.duration) }}
                </div>
              </div>
              <div class="call-actions">
                <button @click="callFromHistory(call.number)" class="call-action-button" title="Llamar">
                  <font-awesome-icon icon="phone" size="sm" />
                </button>
                <button @click="copyToPhoneNumber(call.number)" class="copy-action-button" title="Copiar al teclado">
                  <font-awesome-icon icon="copy" size="sm" />
                </button>
              </div>
            </li>
          </ul>
          <div v-else class="no-history">
            No hay llamadas {{ getHistoryTabText() }}
          </div>
        </div>
      </div>
      <div class="connection-controls">
        <button @click="manualReconnect" :disabled="!connectionLost || reconnecting" class="reconnect-button" title="Reconectar manualmente">
          <font-awesome-icon icon="sync" size="lg" />
        </button>
        <div class="connection-status" :class="connectionStatusClass">
          <font-awesome-icon :icon="connectionStatusIcon" size="sm" />
          <span>{{ connectionStatusText }}</span>
        </div>
      </div>
      <div class="debug-logs">
        <h3>Logs</h3>
        <ul>
          <li v-for="(log, index) in debugLogs" :key="index">{{ log }}</li>
        </ul>
      </div>

      <audio ref="remoteAudio" autoplay></audio>
      <audio ref="localAudio" muted></audio>
    </div>
  </div>
</template>

<script>
import * as SIP from 'sip.js';

export default {
  name: 'SipPhone',
  data() {
    return {
      phoneNumber: '',
      transferNumber: '',
      status: 'Desconectado',
      callInProgress: false,
      incomingCall: false,
      incomingSession: null,
      incomingCaller: '',
      onHold: false,
      transferring: false,
      ua: null,
      session: null,
      localStream: null,
      audioInputDevices: [],
      hasAudioDevice: false,
      dialPad: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'],
      debugLogs: [],
      reconnecting: false,
      reconnectAttempts: 0,
      maxReconnectAttempts: 10,
      reconnectInterval: 3000, // 3 segundos iniciales
      maxReconnectInterval: 30000, // máximo 30 segundos
      reconnectTimer: null,
      connectionLost: false,
      lastConnectedTime: null,
      reconnectingDots: '.',
      dotsTimer: null,
      sipConfig: null, // Para guardar la última configuración SIP exitosa
      callHistory: [],
      activeHistoryTab: 'all', // 'all', 'incoming', 'outgoing', 'missed'
      maxHistoryItems: 50, // Número máximo de llamadas en el historial
      currentCallStart: null, // Timestamp cuando inicia la llamada actual
    };
  },
  computed: {
  connectionStatusClass() {
    if (this.reconnecting) return 'reconnecting';
    return this.connectionLost ? 'disconnected' : 'connected';
  },
  connectionStatusIcon() {
    if (this.reconnecting) return 'sync';
    return this.connectionLost ? 'exclamation-triangle' : 'signal';
  },
  connectionStatusText() {
    if (this.reconnecting) return `Reconectando (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
    return this.connectionLost ? 'Desconectado' : 'Conectado';
  },
  filteredCallHistory() { // Aquí faltaba la coma
    if (this.activeHistoryTab === 'all') {
      return this.callHistory;
    } else {
      return this.callHistory.filter(call => call.type === this.activeHistoryTab);
    }
  }
},
mounted() {
  this.detectDevices();
  this.initializeSIP();
  this.loadCallHistory(); // Cargar historial de llamadas desde localStorage
  setInterval(this.detectDevices, 10000);
  
  // Iniciar animación de puntos para reconexión
  this.dotsTimer = setInterval(() => {
    if (this.reconnectingDots.length >= 3) {
      this.reconnectingDots = '.';
    } else {
      this.reconnectingDots += '.';
    }
  }, 500);
  
  // Monitorear la conectividad a internet
  window.addEventListener('online', this.handleOnline);
  window.addEventListener('offline', this.handleOffline);
},
beforeUnmount() {
  // Limpiar timers y event listeners
  if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  if (this.dotsTimer) clearInterval(this.dotsTimer);
  window.removeEventListener('online', this.handleOnline);
  window.removeEventListener('offline', this.handleOffline);
  
  // Cerrar UA si existe
  if (this.ua) {
    this.ua.stop();
  }
},
  methods: {
    log(message) {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = `[${timestamp}] ${message}`;
      this.debugLogs.push(logEntry);
      console.log(logEntry);
      if (this.debugLogs.length > 20) this.debugLogs.shift();
    },
    async detectDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.audioInputDevices = devices.filter(device => device.kind === 'audioinput');
        this.hasAudioDevice = this.audioInputDevices.length > 0;
        this.log(`Dispositivos de audio detectados: ${this.audioInputDevices.length}`);
        this.audioInputDevices.forEach(device => this.log(`Dispositivo: ${device.label || 'Sin etiqueta'} - ${device.deviceId}`));
        if (!this.hasAudioDevice) this.log('No se detectaron dispositivos de audio');
      } catch (error) {
        this.log(`Error al detectar dispositivos: ${error.message}`);
      }
    },
    async createUserAgent(configuration) {
    try {
      if (this.ua) {
        // Si ya hay un UA activo, detenerlo primero
        await this.ua.stop();
        this.ua = null;
      }
      
      this.ua = new SIP.UserAgent(configuration);
      
      this.ua.transport.onConnect = () => {
        this.status = 'Conectado';
        this.log('Transporte WebSocket conectado');
        this.connectionLost = false;
        this.reconnecting = false;
        this.reconnectAttempts = 0;
        this.lastConnectedTime = Date.now();
        
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };
      
      this.ua.transport.onDisconnect = (error) => {
        const errorMsg = error?.message || 'Desconocido';
        this.log(`Transporte desconectado: ${errorMsg}`);
        
        if (this.callInProgress) {
          this.log('Llamada interrumpida por pérdida de conexión');
          this.resetCallState();
        }
        
        this.status = 'Desconectado';
        this.connectionLost = true;
        
        // Iniciar proceso de reconexión automática
        if (!this.reconnecting) {
          this.startReconnection();
        }
      };

      this.ua.delegate = {
        onInvite: (invitation) => {
          this.log(`Llamada entrante de ${invitation.remoteIdentity.uri.user}`);
          this.incomingCall = true;
          this.incomingSession = invitation;
          this.incomingCaller = invitation.remoteIdentity.uri.user || 'Desconocido';
          this.status = 'Llamada entrante';
          this.setupSessionListeners(invitation);
        },
      };

      await this.ua.start();
      this.log('Conexión SIP establecida');
    } catch (error) {
      this.status = 'Error de conexión';
      this.log(`Error al conectar: ${error.message}`);
      this.connectionLost = true;
      
      // Iniciar reconexión automática
      if (!this.reconnecting) {
        this.startReconnection();
      }
    }
  },
    async initializeSIP() {
      const sipServer = import.meta.env.VITE_SIP_SERVER || 'wss://webrtc.soportedinamico.com:8089/ws';
      const sipUser = import.meta.env.VITE_SIP_USER;
      const sipPassword = import.meta.env.VITE_SIP_PASSWORD;

      this.log(`Iniciando conexión a ${sipServer} con usuario ${sipUser}`);
      const uri = SIP.UserAgent.makeURI(`sip:${sipUser}@webrtc.soportedinamico.com`);

      // Guardar configuración para reconexiones futuras
      this.sipConfig = {
        server: sipServer,
        user: sipUser,
        password: sipPassword,
        domain: 'webrtc.soportedinamico.com'
      };

      const configuration = {
        uri,
        transportOptions: {
          wsServers: [sipServer],
          traceSip: true,
          connectionTimeout: 15,
          reconnectionAttempts: 0, // Manejamos la reconexión manualmente
          reconnectionTimeout: 3,
        },
        authorizationUsername: sipUser,
        authorizationPassword: sipPassword,
        register: true,
        userAgentString: `Browser Phone 0.3.29 (SIPJS - 0.20.0)`,
        registerOptions: {
          expires: 300,
          refreshFrequency: 50,
        },
        sessionDescriptionHandlerFactoryOptions: {
          peerConnectionOptions: {
            rtcConfiguration: {
              iceServers: JSON.parse('[{"urls": "stun:stun.l.google.com:19302"}]'),
              bundlePolicy: 'balanced',
              rtcpMuxPolicy: 'negotiate',
              iceTransportPolicy: 'all',
              iceCandidatePoolSize: 0,
            },
            iceCheckingTimeout: 500,
          },
          alwaysAcquireMediaFirst: true,
          constraints: {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          },
        },
      };
      await this.createUserAgent(configuration);
    },
    dial(digit) {
      this.phoneNumber += digit;
      this.log(`Dígito marcado: ${digit}`);
    },
    async makeCall() {
      if (!this.ua || !this.phoneNumber) {
        this.log('No se puede llamar: Falta número o UA no inicializado');
        return;
      }
      if (!this.hasAudioDevice) {
        this.log('No hay dispositivos de audio disponibles');
        return;
      }

      const target = SIP.UserAgent.makeURI(`sip:${this.phoneNumber}@webrtc.soportedinamico.com`);
      this.log(`Iniciando llamada a ${this.phoneNumber}`);

      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        this.localStream.getTracks().forEach(track => this.log(`Track local: ${track.kind} - ${track.id} - Habilitado: ${track.enabled}`));
        this.$refs.localAudio.srcObject = this.localStream;
      } catch (error) {
        this.log(`Error al obtener micrófono: ${error.message}`);
        return;
      }

      const inviter = new SIP.Inviter(this.ua, target, {
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
          stream: this.localStream,
        },
      });

      this.session = inviter;
      this.setupSessionListeners(inviter);

      try {
        await inviter.invite();
        this.currentCallStart = Date.now(); // Registrar inicio de llamada
        this.log('Invitación SIP enviada');
      } catch (error) {
        this.status = 'Error en la llamada';
        this.log(`Error al iniciar llamada: ${error.message}`);
        this.cleanupStream();
      }
    },
    async acceptCall() {
      if (!this.incomingSession) {
        this.log('No hay sesión entrante para aceptar');
        return;
      }
      if (!this.hasAudioDevice) {
        this.log('No hay dispositivos de audio disponibles');
        return;
      }

      this.log('Aceptando llamada entrante');
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        this.localStream.getTracks().forEach(track => this.log(`Track local: ${track.kind} - ${track.id} - Habilitado: ${track.enabled}`));
        this.$refs.localAudio.srcObject = this.localStream;

        await this.incomingSession.accept({
          sessionDescriptionHandlerOptions: {
            constraints: { audio: true, video: false },
            stream: this.localStream,
          },
        });
        this.session = this.incomingSession; 
        this.currentCallStart = Date.now(); // Registrar inicio de llamada entrante
        // Registrar llamada entrante en el historial
        this.addCallToHistory({
          number: this.incomingCaller,
          type: 'incoming',
          timestamp: Date.now(),
          duration: 0, // Se actualizará al finalizar la llamada
          endReason: 'accepted'
        });// Asegurar que this.session se actualice
        this.callInProgress = true;
        this.incomingCall = false;
        this.status = 'En llamada';
        this.log('Llamada aceptada');
      } catch (error) {
        this.status = 'Error al aceptar';
        this.log(`Error al aceptar llamada: ${error.message}`);
        this.cleanupStream();
      }
    },
    rejectCall() {
      if (this.incomingSession) {
        this.log('Rechazando llamada entrante');
        this.incomingSession.reject();
        this.incomingCall = false;
        this.incomingSession = null;
        this.status = 'Llamada rechazada';
        // Registrar llamada rechazada
        this.addCallToHistory({
          number: this.incomingCaller,
          type: 'missed',
          timestamp: Date.now(),
          duration: 0,
          endReason: 'rejected'
        });
      }
    },
    hangUp() {
      if (!this.session) {
        this.log('No hay sesión activa para colgar');
        return;
      }
      this.log('Colgando llamada');
      try {
        this.session.bye();
        this.resetCallState();
      } catch (error) {
        this.log(`Error al colgar: ${error.message}`);
      }
    },
    toggleHold() {
      if (!this.session) {
        this.log('No hay sesión activa para pausar/reanudar');
        return;
      }

      if (this.session.state !== SIP.SessionState.Established) {
        this.log('La sesión no está establecida, no se puede pausar/reanudar');
        return;
      }

      if (this.onHold) {
        this.log('Reanudando llamada');
        this.session
          .unhold()
          .then(() => {
            this.onHold = false;
            this.status = 'En llamada';
            this.log('Llamada reanudada');
          })
          .catch(error => {
            this.log(`Error al reanudar: ${error.message}`);
          });
      } else {
        this.log('Pausando llamada');
        this.session
          .hold()
          .then(() => {
            this.onHold = true;
            this.status = 'En pausa';
            this.log('Llamada pausada');
          })
          .catch(error => {
            this.log(`Error al pausar: ${error.message}`);
          });
      }
    },
    initTransfer() {
      if (!this.session) {
        this.log('No hay sesión activa para transferir');
        return;
      }
      this.transferring = true;
      this.status = 'Ingresa el número para transferir';
      this.log('Iniciando transferencia');
    },
    completeTransfer() {
      if (!this.session || !this.transferNumber) {
        this.log('No se puede transferir: Falta número o sesión');
        return;
      }

      const transferTarget = SIP.UserAgent.makeURI(`sip:${this.transferNumber}@webrtc.soportedinamico.com`);
      this.log(`Transfiriendo llamada a ${this.transferNumber}`);
      this.session
        .refer(transferTarget)
        .then(() => {
          this.resetCallState();
          this.transferring = false;
          this.transferNumber = '';
          this.status = 'Llamada transferida';
          this.log('Transferencia completada');
        })
        .catch(error => {
          this.status = 'Error al transferir';
          this.log(`Error al transferir: ${error.message}`);
        });
    },
    cancelTransfer() {
      this.transferring = false;
      this.transferNumber = '';
      this.status = 'En llamada';
      this.log('Transferencia cancelada');
    },
    setupSessionListeners(session) {
      session.stateChange.addListener(state => {
        this.log(`Estado de la sesión: ${state}`);
        if (state === SIP.SessionState.Established) {
          this.status = 'En llamada';
          this.callInProgress = true;
          this.setupAudio(session);
        } else if (state === SIP.SessionState.Terminated) {
          this.resetCallState();
        }
      });
    },
    setupAudio(session) {
      const peerConnection = session.sessionDescriptionHandler.peerConnection;
      if (!peerConnection) {
        this.log('Error: PeerConnection no disponible');
        return;
      }

      this.log('Configurando audio WebRTC');

      peerConnection.getReceivers().forEach(receiver => {
        if (receiver.track && receiver.track.kind === 'audio') {
          const remoteStream = new MediaStream();
          remoteStream.addTrack(receiver.track);
          this.log(`Track remoto asignado: ${receiver.track.id} - Habilitado: ${receiver.track.enabled}`);
          this.$refs.remoteAudio.srcObject = remoteStream;
          this.$refs.remoteAudio
            .play()
            .then(() => this.log('Audio remoto reproduciéndose'))
            .catch(error => this.log(`Error al reproducir audio remoto: ${error.message}`));
        }
      });

      peerConnection.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
          this.log(`Track local enviado: ${sender.track.id} - Habilitado: ${sender.track.enabled}`);
        }
      });

      peerConnection.ontrack = event => {
        const stream = event.streams[0];
        this.log(`Stream remoto recibido en ontrack: ${stream.id}, Tracks: ${stream.getTracks().length}`);
        stream.getTracks().forEach(track => {
          this.log(`Track remoto: ${track.kind} - ${track.id} - Habilitado: ${track.enabled}`);
          track.onunmute = () => this.log(`Track ${track.id} desmuteado`);
          track.onmute = () => this.log(`Track ${track.id} muteado`);
        });
        this.$refs.remoteAudio.srcObject = stream;
        this.$refs.remoteAudio
          .play()
          .then(() => this.log('Audio remoto reproduciéndose'))
          .catch(error => this.log(`Error al reproducir audio en ontrack: ${error.message}`));
      };

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          this.log(`Candidato ICE: ${event.candidate.candidate}`);
        } else {
          this.log('Fin de generación de candidatos ICE');
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        this.log(`Estado ICE: ${state}`);
        if (state === 'connected' || state === 'completed') {
          this.log('Conexión ICE establecida');
        } else if (state === 'failed') {
          this.log('Conexión ICE falló');
          this.status = 'Error en la conexión';
        }
      };
    },
    cleanupStream() {
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
        this.$refs.localAudio.srcObject = null;
        this.log('Stream local limpiado');
      }
    },
    resetCallState() {
  // Registrar la llamada si es necesario
      if (this.callInProgress && this.currentCallStart) {
        const callNumber = this.session?.remoteIdentity?.uri?.user || this.phoneNumber;
        this.addCallToHistory({
          number: callNumber,
          type: 'outgoing',
          timestamp: this.currentCallStart,
          duration: Math.floor((Date.now() - this.currentCallStart) / 1000),
          endReason: 'completed'
        });
        this.currentCallStart = null;
      }

      this.cleanupStream();
      this.session = null;
      this.callInProgress = false;
      this.incomingCall = false;
      this.incomingSession = null;
      this.onHold = false;
      this.transferring = false;
      this.phoneNumber = '';
      this.status = 'Conectado';
      this.$refs.remoteAudio.srcObject = null;
      this.log('Estado de llamada reiniciado');
    },
    startReconnection() {
    if (!this.sipConfig) {
      this.log('No hay configuración SIP disponible para reconexión');
      return;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log(`Se alcanzó el máximo de intentos de reconexión (${this.maxReconnectAttempts})`);
      this.reconnecting = false;
      return;
    }
    
    this.reconnecting = true;
    this.reconnectAttempts++;
    
    // Usar backoff exponencial para los intervalos de reconexión
    const delay = Math.min(this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1), this.maxReconnectInterval);
    
    this.log(`Intentando reconexión (${this.reconnectAttempts}/${this.maxReconnectAttempts}) en ${delay/1000} segundos...`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.log('Ejecutando reconexión...');
      
      const { server, user, password, domain } = this.sipConfig;
      const uri = SIP.UserAgent.makeURI(`sip:${user}@${domain}`);
      
      const configuration = {
        uri,
        transportOptions: {
          wsServers: [server],
          traceSip: true,
          connectionTimeout: 15,
          reconnectionAttempts: 0,
          reconnectionTimeout: 3,
        },
        authorizationUsername: user,
        authorizationPassword: password,
        register: true,
        userAgentString: `Browser Phone 0.3.29 (SIPJS - 0.20.0)`,
        registerOptions: {
          expires: 300,
          refreshFrequency: 50,
        },
        sessionDescriptionHandlerFactoryOptions: {
          peerConnectionOptions: {
            rtcConfiguration: {
              iceServers: JSON.parse('[{"urls": "stun:stun.l.google.com:19302"}]'),
              bundlePolicy: 'balanced',
              rtcpMuxPolicy: 'negotiate',
              iceTransportPolicy: 'all',
              iceCandidatePoolSize: 0,
            },
            iceCheckingTimeout: 500,
          },
          alwaysAcquireMediaFirst: true,
          constraints: {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          },
        },
      };
      
      try {
        await this.createUserAgent(configuration);
      } catch (error) {
        this.log(`Error en intento de reconexión: ${error.message}`);
        
        // Programar el siguiente intento si no alcanzamos el máximo
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.startReconnection();
        } else {
          this.reconnecting = false;
          this.log('Se han agotado los intentos de reconexión');
        }
      }
    }, delay);
  },

  manualReconnect() {
    if (this.reconnecting) return;
    
    this.log('Reconexión manual iniciada');
    this.reconnectAttempts = 0;
    this.startReconnection();
  },

  handleOnline() {
    this.log('Se ha detectado conexión a internet');
    if (this.connectionLost && !this.reconnecting) {
      this.log('Intentando reconexión automática al volver a estar en línea');
      this.reconnectAttempts = 0;
      this.startReconnection();
    }
  },

  handleOffline() {
    this.log('Se ha perdido la conexión a internet');
    this.connectionLost = true;
  },
    // Métodos para historial de llamadas
  addCallToHistory(call) {
    // Agregar llamada al historial
    this.callHistory.unshift(call); // Añadir al inicio del array
    
    // Limitar el tamaño del historial
    if (this.callHistory.length > this.maxHistoryItems) {
      this.callHistory = this.callHistory.slice(0, this.maxHistoryItems);
    }
    
    // Guardar en localStorage
    this.saveCallHistory();
    
    // Registrar en logs
    this.log(`Llamada ${call.type} ${call.endReason === 'missed' ? 'perdida' : 'registrada'}: ${call.number}`);
  },

  saveCallHistory() {
    try {
      localStorage.setItem('callHistory', JSON.stringify(this.callHistory));
    } catch (error) {
      this.log(`Error al guardar historial: ${error.message}`);
    }
  },

  loadCallHistory() {
    try {
      const saved = localStorage.getItem('callHistory');
      if (saved) {
        this.callHistory = JSON.parse(saved);
        this.log(`Historial de llamadas cargado: ${this.callHistory.length} llamadas`);
      }
    } catch (error) {
      this.log(`Error al cargar historial: ${error.message}`);
      this.callHistory = [];
    }
  },

  clearCallHistory() {
    this.callHistory = [];
    localStorage.removeItem('callHistory');
    this.log('Historial de llamadas borrado');
  },

  callFromHistory(number) {
    this.phoneNumber = number;
    this.makeCall();
  },

  copyToPhoneNumber(number) {
    this.phoneNumber = number;
  },

  getCallIcon(type) {
    switch (type) {
      case 'incoming': return 'phone-alt';
      case 'outgoing': return 'phone-volume';
      case 'missed': return 'phone-slash';
      default: return 'phone';
    }
  },

  formatCallTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
  },

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  },

  getHistoryTabText() {
    switch (this.activeHistoryTab) {
      case 'incoming': return 'recibidas';
      case 'outgoing': return 'realizadas';
      case 'missed': return 'perdidas';
      default: return 'registradas';
    }
  }
  } // Cierre de methods
}; // Cierre de export default
  
</script>

<style scoped>
.sip-phone {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f0f0;
}

.phone-body {
  width: 320px;
  padding: 20px;
  background: linear-gradient(145deg, #2c2c2c, #1f1f1f);
  border-radius: 20px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5);
  color: white;
}

.phone-screen {
  background: #000;
  padding: 15px;
  border-radius: 15px 15px 0 0;
  text-align: center;
}

.number-input {
  width: 100%;
  padding: 10px;
  font-size: 20px;
  background: #333;
  border: none;
  border-radius: 5px;
  color: white;
  text-align: center;
}

.status {
  margin-top: 10px;
  font-size: 14px;
  color: #bbb;
}

.dial-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 20px;
}

.dial-button {
  width: 60px;
  height: 60px;
  background: #444;
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  transition: background 0.2s;
}

.dial-button:hover:not(:disabled) {
  background: #555;
}

.dial-button:disabled {
  background: #666;
  cursor: not-allowed;
}

.call-controls {
  display: flex;
  justify-content: space-around;
  padding: 10px 0;
}

.call-button,
.hang-up-button,
.control-button {
  width: 60px;
  height: 60px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s;
}

.call-button {
  background: #28a745;
}

.call-button:hover:not(:disabled) {
  transform: scale(1.1);
}

.hang-up-button {
  background: #dc3545;
}

.hang-up-button:hover:not(:disabled) {
  transform: scale(1.1);
}

.control-button {
  background: #007bff;
}

.control-button:hover:not(:disabled) {
  transform: scale(1.1);
}

.control-button:disabled,
.call-button:disabled,
.hang-up-button:disabled {
  background: #666;
  cursor: not-allowed;
}

.transfer-section {
  padding: 10px;
  display: flex;
  gap: 10px;
  justify-content: center;
}

.transfer-input {
  padding: 8px;
  font-size: 16px;
  background: #333;
  border: none;
  border-radius: 5px;
  color: white;
  width: 60%;
}

.transfer-confirm,
.transfer-cancel {
  width: 40px;
  height: 40px;
  background: #28a745;
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
}

.transfer-cancel {
  background: #dc3545;
}

.incoming-call {
  padding: 10px;
  background: #222;
  border-radius: 5px;
  text-align: center;
}

.incoming-call p {
  margin: 0 0 10px 0;
}

.accept-button,
.reject-button {
  width: 60px;
  height: 60px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  margin: 0 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.accept-button {
  background: #28a745;
}

.reject-button {
  background: #dc3545;
}

.debug-logs {
  margin-top: 20px;
  max-height: 150px;
  overflow-y: auto;
  background: #333;
  padding: 10px;
  border-radius: 5px;
  font-size: 12px;
}

.debug-logs h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
}

.debug-logs ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.debug-logs li {
  padding: 2px 0;
  color: #ccc;
}
.reconnecting-indicator {
  margin-top: 5px;
  font-size: 12px;
  color: #ffc107;
  animation: blink 1s infinite;
}

.reconnecting-indicator .dots {
  display: inline-block;
  min-width: 20px;
}

@keyframes blink {
  50% { opacity: 0.5; }
}

.connection-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding: 8px;
  background: #333;
  border-radius: 5px;
}

.reconnect-button {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #007bff;
  color: white;
  cursor: pointer;
}

.reconnect-button:disabled {
  background: #666;
  cursor: not-allowed;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}

.connection-status.connected {
  color: #28a745;
}

.connection-status.disconnected {
  color: #dc3545;
}

.connection-status.reconnecting {
  color: #ffc107;
}
/* Estilos para historial de llamadas */
.call-history {
  margin-top: 15px;
  background: #222;
  border-radius: 10px;
  overflow: hidden;
}

.history-header {
  padding: 10px;
  background: #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-header h3 {
  margin: 0;
  font-size: 16px;
}

.clear-history-button {
  background: transparent;
  border: none;
  color: #dc3545;
  cursor: pointer;
  padding: 5px;
}

.history-tabs {
  display: flex;
  background: #444;
}

.history-tab-button {
  flex: 1;
  background: transparent;
  border: none;
  padding: 8px 5px;
  color: #ccc;
  cursor: pointer;
  font-size: 12px;
  text-align: center;
  transition: background 0.2s, color 0.2s;
}

.history-tab-button.active {
  background: #666;
  color: white;
  font-weight: bold;
}

.history-list-container {
  max-height: 200px;
  overflow-y: auto;
  padding: 0;
}

.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.history-item {
  display: flex;
  padding: 10px;
  border-bottom: 1px solid #444;
  align-items: center;
}

.call-icon {
  margin-right: 10px;
  width: 20px;
  text-align: center;
}

.incoming {
  color: #28a745;
}

.outgoing {
  color: #007bff;
}

.missed {
  color: #dc3545;
}

.call-details {
  flex-grow: 1;
}

.call-number {
  font-size: 14px;
}

.call-time, .call-duration {
  font-size: 10px;
  color: #aaa;
  margin-top: 2px;
}

.call-actions {
  display: flex;
}

.call-action-button, .copy-action-button {
  width: 30px;
  height: 30px;
  background: #444;
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  margin-left: 5px;
}

.call-action-button:hover {
  background: #28a745;
}

.copy-action-button:hover {
  background: #007bff;
}

.no-history {
  padding: 15px;
  text-align: center;
  color: #aaa;
  font-size: 12px;
}
</style>