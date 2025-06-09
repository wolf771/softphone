<template>
  <div class="sip-phone-container">
    <!-- Contenedor principal del teléfono -->
    <div class="main-phone-wrapper">
      <!-- Botón para mostrar/ocultar el historial -->
      <button @click="toggleHistoryVisibility" class="toggle-history-button" :title="showCallHistory ? 'Ocultar historial' : 'Mostrar historial'">
        <font-awesome-icon :icon="showCallHistory ? 'chevron-right' : 'chevron-left'" />
      </button>
      
      <div class="phone-body">
      <div class="main-section">
        <div class="phone-header">
          <button @click="toggleSettings" class="settings-button" title="Configuración">
            <font-awesome-icon icon="cog" size="lg" />
          </button>
          <h2>Softphone</h2>
        </div>
        
        <div class="phone-screen">
          <input 
            v-model="phoneNumber" 
            placeholder="Marca un número" 
            :disabled="callInProgress || incomingCall" 
            class="number-input"
            @keyup.enter="handleEnterKey" 
          />
          <div class="status">{{ status }}</div>
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
          <button @click="toggleHold" :disabled="!callInProgress || transferring || conferencing" class="control-button">
            <font-awesome-icon :icon="onHold ? 'play' : 'pause'" size="lg" />
          </button>
          <button @click="initTransfer" :disabled="!callInProgress || onHold || transferring || conferencing" class="control-button">
            <font-awesome-icon icon="share-square" size="lg" />
          </button>
          <!-- Agregar botón de conferencia -->
          <button @click="initConference" :disabled="!callInProgress || onHold || transferring || conferencing" class="control-button">
            <font-awesome-icon icon="users" size="lg" />
          </button>
        </div>
      </div>

      <div v-if="reconnecting" class="reconnecting-indicator">
        <span>Reconectando</span>
        <span class="dots">{{ reconnectingDots }}</span>
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
      <div class="connection-controls">
        <div class="connection-buttons">
          <button @click="manualReconnect" :disabled="!connectionLost || reconnecting" class="reconnect-button" title="Reconectar manualmente">
            <font-awesome-icon icon="sync" size="lg" />
          </button>
          <button @click="registerUser" :disabled="isRegistered || !ua || reconnecting" class="register-button" title="Registrar usuario">
            <font-awesome-icon icon="user-plus" size="lg" />
          </button>
          <button @click="unregisterUser" :disabled="!isRegistered || reconnecting" class="unregister-button" title="Desregistrar usuario">
            <font-awesome-icon icon="user-minus" size="lg" />
          </button>
        </div>
        <div class="connection-status" :class="connectionStatusClass">
          <font-awesome-icon :icon="connectionStatusIcon" size="sm" />
          <span>{{ connectionStatusText }}</span>
        </div>
      </div>
      <div class="debug-logs">
        <h3 @click="toggleLogsVisibility">Logs <span>{{ showLogs ? '▲' : '▼' }}</span></h3>
        <ul v-if="showLogs">
          <li v-for="(log, index) in debugLogs" :key="index">{{ log }}</li>
        </ul>
      </div>

      <audio ref="remoteAudio" autoplay></audio>
      <audio ref="localAudio" muted></audio>
      <audio ref="ringtoneAudio" preload="auto" loop>
        <source :src="ringtoneUrl" type="audio/mpeg">
      </audio>
      <audio ref="ringbackAudio" preload="auto" loop>
        <source src="/sounds/ringback.mp3" type="audio/mpeg">
      </audio>
    </div>
    </div> <!-- Cierre del main-phone-wrapper -->
    
    <!-- Panel de historial a la derecha -->
    <div class="call-history-panel" :class="{ 'hidden': !showCallHistory }">
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
    
    <!-- Agregar el diálogo de transferencia -->
    <div v-if="transferring" class="transfer-dialog">
      <div class="transfer-content">
        <h3>Transferir llamada</h3>
        <input 
          v-model="transferNumber" 
          placeholder="Ingrese número para transferir" 
          class="transfer-input"
          type="text"
        />
        <div class="transfer-buttons">
          <button @click="completeTransfer" class="transfer-confirm" :disabled="!transferNumber">
            <font-awesome-icon icon="share-square" />
            Transferir
          </button>
          <button @click="cancelTransfer" class="transfer-cancel">
            <font-awesome-icon icon="times" />
            Cancelar
          </button>
        </div>
      </div>
    </div>
    
    <!-- Agregar el diálogo de conferencia -->
    <div v-if="conferencing" class="conference-dialog">
      <div class="conference-content">
        <h3>Agregar participante a la conferencia</h3>
        <input 
          v-model="conferenceNumber" 
          placeholder="Ingrese número para conferencia" 
          class="conference-input"
          type="text"
        />
        <div class="conference-buttons">
          <button @click="completeConference" class="conference-confirm" :disabled="!conferenceNumber">
            <font-awesome-icon icon="users" />
            Agregar
          </button>
          <button @click="cancelConference" class="conference-cancel">
            <font-awesome-icon icon="times" />
            Cancelar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Configuración -->
    <div v-if="showSettings" class="settings-modal-overlay" @click="closeSettings">
      <div class="settings-modal" @click.stop>
        <div class="settings-header">
          <h2>Configuración</h2>
          <button @click="closeSettings" class="close-button">
            <font-awesome-icon icon="times" />
          </button>
        </div>
        
        <div class="settings-content">
          <!-- Controles de Volumen -->
          <div class="settings-section">
            <div class="section-header" @click="toggleVolumeControls">
              <h3>Controles de Volumen</h3>
              <font-awesome-icon :icon="showVolumeControls ? 'chevron-up' : 'chevron-down'" />
            </div>
            <div v-show="showVolumeControls" class="section-content">
              <div class="volume-control">
                <label for="incomingVolume">Volumen Entrante</label>
                <input type="range" id="incomingVolume" v-model="incomingVolume" min="0" max="1" step="0.01" @input="adjustIncomingVolume" />
                <span class="volume-value">{{ Math.round(incomingVolume * 100) }}%</span>
              </div>
              <div class="volume-control">
                <label for="outgoingVolume">Volumen Saliente</label>
                <input type="range" id="outgoingVolume" v-model="outgoingVolume" min="0" max="1" step="0.01" @input="adjustOutgoingVolume" />
                <span class="volume-value">{{ Math.round(outgoingVolume * 100) }}%</span>
              </div>
            </div>
          </div>

          <!-- Dispositivos de Audio -->
          <div class="settings-section">
            <div class="section-header" @click="toggleAudioDevices">
              <h3>Dispositivos de Audio</h3>
              <font-awesome-icon :icon="showAudioDevices ? 'chevron-up' : 'chevron-down'" />
            </div>
            <div v-show="showAudioDevices" class="section-content">
              <label for="audioDevice">Dispositivo de Audio:</label>
              <select id="audioDevice" v-model="selectedAudioDevice" @change="changeAudioDevice">
                <option v-for="device in audioInputDevices" :key="device.deviceId" :value="device.deviceId">
                  {{ device.label || 'Dispositivo sin etiqueta' }}
                </option>
              </select>
            </div>
          </div>

          <!-- Credenciales SIP -->
          <div class="settings-section">
            <div class="section-header" @click="toggleCredentials">
              <h3>Credenciales SIP</h3>
              <font-awesome-icon :icon="showCredentials ? 'chevron-up' : 'chevron-down'" />
            </div>
            <div v-show="showCredentials" class="section-content">
              <div class="input-group">
                <label for="sipUser">Usuario SIP:</label>
                <input id="sipUser" v-model="sipUser" placeholder="Usuario SIP" class="settings-input" />
              </div>
              <div class="input-group">
                <label for="sipPassword">Contraseña SIP:</label>
                <input id="sipPassword" v-model="sipPassword" type="password" placeholder="Contraseña SIP" class="settings-input" />
              </div>
              <button @click="saveCredentials" class="save-button">Guardar Credenciales</button>
            </div>
          </div>

          <!-- Contactos Frecuentes -->
          <div class="settings-section">
            <div class="section-header" @click="toggleFrequentContacts">
              <h3>Contactos Frecuentes</h3>
              <font-awesome-icon :icon="showFrequentContacts ? 'chevron-up' : 'chevron-down'" />
            </div>
            <div v-show="showFrequentContacts" class="section-content">
              <div class="contacts-list">
                <div v-for="(contact, index) in frequentContacts" :key="index" class="contact-item">
                  <span class="contact-number">{{ contact }}</span>
                  <div class="contact-actions">
                    <button @click="callFromHistory(contact)" class="contact-call-button" title="Llamar">
                      <font-awesome-icon icon="phone" size="sm" />
                    </button>
                    <button @click="removeFrequentContact(index)" class="contact-remove-button" title="Eliminar">
                      <font-awesome-icon icon="trash-alt" size="sm" />
                    </button>
                  </div>
                </div>
              </div>
              <div class="add-contact">
                <input v-model="newContact" placeholder="Agregar nuevo contacto" class="settings-input" />
                <button @click="addFrequentContact" class="add-button">Agregar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import * as SIP from 'sip.js';
import './SipPhone.styles.css';

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
      showCallHistory: true, // Controla si el historial está visible
      showLogs: false, // Añadir propiedad para controlar la visibilidad de los logs
      frequentContacts: [], // Lista de contactos frecuentes
      newContact: '', // Nuevo contacto a agregar
      incomingVolume: 1, // Volumen del audio entrante
      outgoingVolume: 1, // Volumen del audio saliente
      selectedAudioDevice: '', // Dispositivo de audio seleccionado
      sipUser: '', // Usuario SIP
      sipPassword: '', // Contraseña SIP
      ringtone: null,
      showVolumeControls: false,
      showAudioDevices: false,
      showCredentials: false,
      showFrequentContacts: false,
      showSettings: false, // Controla la visibilidad del modal de configuración
      isRegistered: false,
      registrationState: '',
      registrationInProgress: false,
      ringtoneUrl: '/sounds/ringtone.mp3',
      ringtonePromise: null,
      ringbackUrl: '/sounds/ringback.mp3',
      callState: '', // Nuevo estado para tracking de la llamada
      conferencing: false,
      conferenceNumber: '',
      conferenceSession: null,
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
    if (this.reconnecting) {
      return `Reconectando (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
    }
    if (this.connectionLost) {
      return 'Desconectado';
    }
    if (this.isRegistered) {
      return 'Registrado';
    }
    return this.registrationState || 'No Registrado';
  },
  statusText() {
    if (this.callInProgress) return 'En llamada';
    if (this.incomingCall) return 'Llamada entrante';
    if (this.onHold) return 'En espera';
    if (this.transferring) return 'Transfiriendo';
    if (this.reconnecting) return 'Reconectando...';
    if (this.connectionLost) return 'Sin conexión';
    if (this.isRegistered) return 'Listo para llamar';
    return this.registrationState || 'No registrado';
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
  // Cargamos primero las credenciales antes de inicializar SIP
  this.loadCredentials();
  // Solo inicializamos SIP si hay credenciales
  if (this.sipUser && this.sipPassword) {
    this.initializeSIP();
  }
  this.loadCallHistory(); // Cargar historial de llamadas desde localStorage
  // Cargar preferencia de visibilidad del historial
    const savedHistoryVisibility = localStorage.getItem('showCallHistory');
    if (savedHistoryVisibility !== null) {
      this.showCallHistory = JSON.parse(savedHistoryVisibility);
    }
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
  this.loadFrequentContacts(); // Cargar contactos frecuentes desde localStorage

  // Precarga del ringtone
  const ringtone = this.$refs.ringtoneAudio;
  if (ringtone) {
    ringtone.load();
    this.log('Ringtone precargado');
  }
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

  this.stopRingtone();
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
          if (this.registrationInProgress) {
            this.log('Registro en progreso, esperando...');
            return;
          }
          this.log('Deteniendo UA existente');
          await this.ua.stop();
          this.ua = null;
        }
        
        this.ua = new SIP.UserAgent(configuration);
        const registerer = new SIP.Registerer(this.ua, {
          expires: 300,
          refreshFrequency: 50,
        });
        
        // Manejar eventos del registrador
        registerer.stateChange.addListener((state) => {
          this.log(`Estado del registrador: ${state}`);
          this.registrationInProgress = state === SIP.RegistererState.Registering;
          
          switch (state) {
            case SIP.RegistererState.Initial:
              this.registrationState = 'Iniciando registro';
              break;
            case SIP.RegistererState.Registered:
              this.isRegistered = true;
              this.registrationState = 'Registrado';
              this.status = 'Listo para llamar';
              this.registrationInProgress = false;
              break;
            case SIP.RegistererState.Unregistered:
              this.isRegistered = false;
              this.registrationState = 'No registrado';
              this.registrationInProgress = false;
              break;
            case SIP.RegistererState.Terminated:
              this.isRegistered = false;
              this.registrationState = 'Terminado';
              this.registrationInProgress = false;
              break;
          }
        });

        // Modificar el delegate del UA
        this.ua.delegate = {
          onConnect: async () => {
            this.log('UA conectado al servidor SIP');
            if (!this.registrationInProgress && !this.isRegistered) {
              this.registrationInProgress = true;
              try {
                await registerer.register();
                this.log('Registro iniciado');
              } catch (error) {
                this.log(`Error al registrar: ${error}`);
                this.registrationInProgress = false;
              }
            }
          },
          onDisconnect: (error) => {
            this.log('UA desconectado del servidor SIP');
            this.isRegistered = false;
            this.registrationState = 'Desconectado';
          },
          onInvite: (invitation) => {
            this.log(`Llamada entrante de ${invitation.remoteIdentity.uri.user}`);
            this.incomingCall = true;
            this.incomingSession = invitation;
            this.incomingCaller = invitation.remoteIdentity.uri.user || 'Desconocido';
            this.status = 'Llamada entrante';
            this.playRingtone(); // Reproducir timbre cuando hay llamada entrante
            this.setupSessionListeners(invitation);
          }
        };

        await this.ua.start();
        this.log('UA iniciado');
        
        // Solo registrar si no hay un registro en progreso
        if (!this.registrationInProgress) {
          this.registrationInProgress = true;
          await registerer.register();
        }
        
        // Guardar referencia al registrador
        this.ua.registerer = registerer;
        
      } catch (error) {
        this.registrationInProgress = false;
        if (error.message.includes('401')) {
          this.status = 'Error de autenticación';
          this.log('Error de autenticación: Verifique las credenciales SIP');
        } else {
          this.status = 'Error de conexión';
          this.log(`Error al conectar: ${error.message}`);
        }
        this.connectionLost = true;
        
        // Iniciar reconexión automática
        if (!this.reconnecting) {
          this.startReconnection();
        }
      }
    },

    // Agregar método para verificar estado de registro
    checkRegistrationStatus() {
      if (!this.ua || !this.ua.registerer || this.registrationInProgress) {
        return;
      }
      
      const registrationStatus = this.ua.registerer.state;
      this.log(`Verificando estado de registro: ${registrationStatus}`);
      
      if (this.ua.isConnected() && !this.registrationInProgress) {
        if (registrationStatus !== SIP.RegistererState.Registered) {
          this.log('Intentando registrar nuevamente...');
          this.registrationInProgress = true;
          this.ua.registerer.register()
            .catch(error => {
              this.log(`Error al intentar registrar: ${error}`);
              this.registrationInProgress = false;
            });
        }
      } else {
        this.log('UA no está conectado, intentando reconectar...');
        this.startReconnection();
      }
    },
    // Modificar initializeSIP para incluir opciones adicionales
    async initializeSIP() {
      if (!this.sipUser || !this.sipPassword) {
        this.log('Usuario o contraseña SIP no proporcionados');
        this.status = 'Credenciales SIP no proporcionadas';
        return;
      }

      const sipServer = 'wss://webrtc.soportedinamico.com:8089/ws';
      this.log(`Iniciando conexión a ${sipServer} con usuario ${this.sipUser}`);
      
      // Si hay una conexión existente, la detenemos primero
      if (this.ua) {
        this.log('Deteniendo conexión SIP existente');
        await this.ua.stop();
        this.ua = null;
      }

      const uri = SIP.UserAgent.makeURI(`sip:${this.sipUser}@webrtc.soportedinamico.com`);

      // Guardar configuración para reconexiones futuras
      this.sipConfig = {
        server: sipServer,
        user: this.sipUser,
        password: this.sipPassword,
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
        authorizationUsername: this.sipUser,
        authorizationPassword: this.sipPassword,
        register: true,
        userAgentString: `Browser Phone 0.3.29 (SIPJS - 0.20.0)`,
        registerOptions: {
          expires: 300,
          refreshFrequency: 50,
          extraHeaders: ['X-Requested-With: SIPjs-Client'],
          registrar: `sip:${this.sipConfig.domain}`,
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
      
      // Verificar el estado de registro periódicamente
      setInterval(() => this.checkRegistrationStatus(), 30000); // Cada 30 segundos
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
      this.callState = 'initiating'; // Marcar llamada como iniciando

      try {
        await inviter.invite();
        this.currentCallStart = Date.now();
        this.playRingback();
        this.callState = 'ringing'; // Marcar llamada como sonando
        this.status = 'Llamando...';
        this.log('Invitación SIP enviada');
      } catch (error) {
        this.status = 'Error en la llamada';
        this.log(`Error al iniciar llamada: ${error.message}`);
        this.cleanupStream();
        this.stopRingback();
        this.callState = '';
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
        this.stopRingtone(); // Detener timbre al aceptar
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
        this.stopRingtone(); // Detener timbre al rechazar
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
        // Si la llamada está sonando, usar cancel en lugar de bye
        if (this.callState === 'ringing') {
          this.session.cancel();
          this.log('Llamada saliente cancelada');
        } else {
          this.session.bye();
          this.log('Llamada terminada');
        }
        
        this.stopRingback();
        this.resetCallState();
      } catch (error) {
        this.log(`Error al colgar: ${error.message}`);
      }
    },
    async toggleHold() {
      if (!this.session) {
        this.log('No hay sesión activa para pausar/reanudar');
        return;
      }

      if (this.session.state !== SIP.SessionState.Established) {
        this.log('La sesión no está establecida, no se puede pausar/reanudar');
        return;
      }

      try {
        const sessionDescriptionHandler = this.session.sessionDescriptionHandler;
        if (!sessionDescriptionHandler) {
          throw new Error('Session description handler no disponible');
        }

        if (this.onHold) {
          // Reanudar llamada
          this.log('Reanudando llamada...');
          const options = {
            sessionDescriptionHandlerOptions: {
              hold: false
            }
          };
          
          await this.session.invite(options);
          this.onHold = false;
          this.status = 'En llamada';
          this.log('Llamada reanudada');
        } else {
          // Poner en espera
          this.log('Poniendo llamada en espera...');
          const options = {
            sessionDescriptionHandlerOptions: {
              hold: true
            }
          };
          
          await this.session.invite(options);
          this.onHold = true;
          this.status = 'En espera';
          this.log('Llamada en espera');
        }
      } catch (error) {
        this.log(`Error al ${this.onHold ? 'reanudar' : 'pausar'}: ${error.message}`);
        // Restablecer estado en caso de error
        this.onHold = !this.onHold;
      }

    },
    initTransfer() {
      if (!this.session) {
        this.log('No hay sesión activa para transferir');
        return;
      }
      this.transferring = true;
      this.transferNumber = '';
      this.status = 'Ingresa el número para transferir';
      this.log('Iniciando transferencia');
    },
    async completeTransfer() {
      if (!this.session || !this.transferNumber) {
        this.log('No se puede transferir: Falta número o sesión');
        return;
      }

      try {
        const target = SIP.UserAgent.makeURI(`sip:${this.transferNumber}@webrtc.soportedinamico.com`);
        if (!target) {
          throw new Error('Número de transferencia inválido');
        }

        this.log(`Transfiriendo llamada a ${this.transferNumber}`);
        await this.session.refer(target);
        this.log('Transferencia iniciada');
        this.status = 'Llamada transferida';
        
        // Limpiar estado de transferencia
        this.transferring = false;
        this.transferNumber = '';
        
        // Opcional: colgar la llamada actual después de la transferencia
        await this.session.bye();
        this.resetCallState();
      } catch (error) {
        this.log(`Error al transferir: ${error.message}`);
        this.status = 'Error al transferir';
      }
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
          this.stopRingback();
          this.status = 'En llamada';
          this.callInProgress = true;
          this.callState = 'established';
          this.stopRingtone();
          this.setupAudio(session);
        } else if (state === SIP.SessionState.Terminated) {
          this.stopRingback();
          this.stopRingtone();
          // Si la llamada no fue establecida, registrarla como perdida
          if (this.callState === 'ringing' && !this.incomingCall) {
            this.addCallToHistory({
              number: this.phoneNumber,
              type: 'outgoing',
              timestamp: this.currentCallStart || Date.now(),
              duration: 0,
              endReason: 'cancelled'
            });
          }
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
      this.status = this.statusText;
      this.$refs.remoteAudio.srcObject = null;
      this.stopRingback(); // Asegurar que el ringback se detenga
      this.callState = '';
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

    // Método para mostrar/ocultar el historial
    toggleHistoryVisibility() {
      this.showCallHistory = !this.showCallHistory;
      // Opcional: guardar preferencia en localStorage
      localStorage.setItem('showCallHistory', JSON.stringify(this.showCallHistory));
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
  },
  toggleLogsVisibility() {
    this.showLogs = !this.showLogs;
  },
  addFrequentContact() {
    if (this.newContact && !this.frequentContacts.includes(this.newContact)) {
      this.frequentContacts.push(this.newContact);
      this.newContact = '';
      this.saveFrequentContacts();
    }
  },
  removeFrequentContact(index) {
    this.frequentContacts.splice(index, 1);
    this.saveFrequentContacts();
  },
  saveFrequentContacts() {
    try {
      localStorage.setItem('frequentContacts', JSON.stringify(this.frequentContacts));
    } catch (error) {
      this.log(`Error al guardar contactos frecuentes: ${error.message}`);
    }
  },
  loadFrequentContacts() {
    try {
      const saved = localStorage.getItem('frequentContacts');
      if (saved) {
        this.frequentContacts = JSON.parse(saved);
        this.log(`Contactos frecuentes cargados: ${this.frequentContacts.length} contactos`);
      }
    } catch (error) {
      this.log(`Error al cargar contactos frecuentes: ${error.message}`);
      this.frequentContacts = [];
    }
  },
  adjustIncomingVolume() {
    if (this.$refs.remoteAudio) {
      this.$refs.remoteAudio.volume = this.incomingVolume;
    }
  },
  adjustOutgoingVolume() {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.applyConstraints({
          volume: this.outgoingVolume
        });
      });
    }
  },
  async changeAudioDevice() {
    if (!this.selectedAudioDevice) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: this.selectedAudioDevice },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Reemplazar el stream de audio en la llamada actual
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }
      this.localStream = newStream;
      this.$refs.localAudio.srcObject = this.localStream;

      if (this.session) {
        const sender = this.session.sessionDescriptionHandler.peerConnection.getSenders().find(s => s.track.kind === 'audio');
        if (sender) {
          sender.replaceTrack(this.localStream.getAudioTracks()[0]);
        }
      }

      this.log(`Dispositivo de audio cambiado a: ${this.selectedAudioDevice}`);
    } catch (error) {
      this.log(`Error al cambiar dispositivo de audio: ${error.message}`);
    }
  },
  saveCredentials() {
    localStorage.setItem('sipUser', this.sipUser);
    localStorage.setItem('sipPassword', this.sipPassword);
    this.log('Credenciales SIP guardadas');
    
    // Reiniciar la conexión SIP después de guardar las credenciales
    if (this.sipUser && this.sipPassword) {
      this.log('Reiniciando conexión SIP con nuevas credenciales');
      this.initializeSIP();
    }
  },
  loadCredentials() {
    this.sipUser = localStorage.getItem('sipUser') || '';
    this.sipPassword = localStorage.getItem('sipPassword') || '';
    this.log('Credenciales SIP cargadas');
  },
  async playRingtone() {
    try {
      const ringtone = this.$refs.ringtoneAudio;
      if (!ringtone) {
        this.log('Elemento de audio para ringtone no disponible');
        return;
      }

      ringtone.volume = 0.5;
      this.log('Intentando reproducir ringtone...');
      
      try {
        await ringtone.play();
        this.log('Ringtone reproduciendo');
      } catch (error) {
        if (error.name === 'NotAllowedError') {
          this.log('Error: Permiso denegado para reproducir audio automáticamente');
        } else {
          this.log(`Error al reproducir ringtone: ${error.message}`);
        }
      }
    } catch (error) {
      this.log(`Error general en playRingtone: ${error.message}`);
    }
  },

  stopRingtone() {
    try {
      const ringtone = this.$refs.ringtoneAudio;
      if (ringtone) {
        ringtone.pause();
        ringtone.currentTime = 0;
        this.log('Ringtone detenido');
      }
    } catch (error) {
      this.log(`Error al detener ringtone: ${error.message}`);
    }
  },
  async playRingback() {
    try {
      const ringback = this.$refs.ringbackAudio;
      if (!ringback) {
        this.log('Elemento de audio para ringback no disponible');
        return;
      }

      ringback.volume = 0.3; // Volumen más bajo que el ringtone
      await ringback.play();
      this.log('Reproduciendo ringback tone');
    } catch (error) {
      this.log(`Error al reproducir ringback: ${error.message}`);
    }
  },

  stopRingback() {
    try {
      const ringback = this.$refs.ringbackAudio;
      if (ringback) {
        ringback.pause();
        ringback.currentTime = 0;
        this.log('Ringback detenido');
      }
    } catch (error) {
      this.log(`Error al detener ringback: ${error.message}`);
    }
  },
  toggleVolumeControls() {
    this.showVolumeControls = !this.showVolumeControls;
  },
  toggleAudioDevices() {
    this.showAudioDevices = !this.showAudioDevices;
  },
  toggleCredentials() {
    this.showCredentials = !this.showCredentials;
  },
  toggleFrequentContacts() {
    this.showFrequentContacts = !this.showFrequentContacts;
  },
  toggleSettings() {
    this.showSettings = true;
  },
  closeSettings() {
    this.showSettings = false;
  },
  async registerUser() {
    if (!this.ua || this.registrationInProgress || this.isRegistered) {
      return;
    }
    
    try {
      this.registrationInProgress = true;
      this.log('Iniciando registro manual del usuario...');
      await this.ua.registerer.register();
      this.log('Registro manual iniciado');
    } catch (error) {
      this.log(`Error en registro manual: ${error.message}`);
      this.registrationInProgress = false;
    }
  },

  async unregisterUser() {
    if (!this.ua || !this.isRegistered) {
      return;
    }
    
    try {
      this.log('Desregistrando usuario...');
      await this.ua.registerer.unregister();
      this.log('Usuario desregistrado');
    } catch (error) {
      this.log(`Error al desregistrar: ${error.message}`);
    }
  },
  handleEnterKey() {
    // Verificar si se puede realizar la llamada
    if (this.phoneNumber && !this.callInProgress && !this.incomingCall && !this.reconnecting) {
      this.makeCall();
    }
  },
  initConference() {
    if (!this.session) {
      this.log('No hay sesión activa para conferencia');
      return;
    }
    this.conferencing = true;
    this.conferenceNumber = '';
    this.status = 'Ingrese número para conferencia';
    this.log('Iniciando conferencia');
  },

  async completeConference() {
    if (!this.session || !this.conferenceNumber) {
      this.log('No se puede crear conferencia: Falta número o sesión');
      return;
    }

    try {
      const target = SIP.UserAgent.makeURI(`sip:${this.conferenceNumber}@webrtc.soportedinamico.com`);
      if (!target) {
        throw new Error('Número de conferencia inválido');
      }

      // Crear nueva invitación para el participante de la conferencia
      const inviter = new SIP.Inviter(this.ua, target, {
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false }
        }
      });

      this.log(`Invitando a conferencia a ${this.conferenceNumber}`);
      
      // Almacenar la sesión de conferencia
      this.conferenceSession = inviter;
      
      // Configurar listeners para la sesión de conferencia
      this.setupConferenceListeners(inviter);
      
      await inviter.invite();
      this.log('Invitación de conferencia enviada');
      
      // No cerrar el diálogo hasta que el participante conteste
      this.status = 'Llamando a participante...';
    } catch (error) {
      this.log(`Error al crear conferencia: ${error.message}`);
      this.status = 'Error en conferencia';
      this.cancelConference();
    }
  },

  cancelConference() {
    if (this.conferenceSession) {
      try {
        this.conferenceSession.cancel();
      } catch (error) {
        this.log(`Error al cancelar conferencia: ${error.message}`);
      }
      this.conferenceSession = null;
    }
    this.conferencing = false;
    this.conferenceNumber = '';
    this.status = 'En llamada';
    this.log('Conferencia cancelada');
  },

  setupConferenceListeners(session) {
    session.stateChange.addListener(state => {
      this.log(`Estado de la sesión de conferencia: ${state}`);
      if (state === SIP.SessionState.Established) {
        this.log('Participante conectado a la conferencia');
        this.status = 'Conferencia activa';
        // Mezclar los streams de audio
        this.mixConferenceAudio(session);
        this.conferencing = false;
      } else if (state === SIP.SessionState.Terminated) {
        this.log('Participante desconectado de la conferencia');
        this.conferenceSession = null;
        if (this.conferencing) {
          this.cancelConference();
        }
      }
    });
  },

  mixConferenceAudio(conferenceSession) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Crear nodos para ambas sesiones
      const mainStreamSource = audioContext.createMediaStreamSource(this.session.sessionDescriptionHandler.peerConnection.getRemoteStreams()[0]);
      const conferenceStreamSource = audioContext.createMediaStreamSource(conferenceSession.sessionDescriptionHandler.peerConnection.getRemoteStreams()[0]);
      
      // Crear un nodo mezclador
      const merger = audioContext.createChannelMerger(2);
      
      // Conectar las fuentes al mezclador
      mainStreamSource.connect(merger, 0, 0);
      conferenceStreamSource.connect(merger, 0, 1);
      
      // Conectar el mezclador a la salida
      merger.connect(audioContext.destination);
      
      this.log('Audio de conferencia mezclado correctamente');
    } catch (error) {
      this.log(`Error al mezclar audio de conferencia: ${error.message}`);
    }
  },
  } // Cierre de methods
}; // Cierre de export default
  
</script>

<style scoped>
/* Los estilos se han movido a SipPhone.styles.css */
</style>