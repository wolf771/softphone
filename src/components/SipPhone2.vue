<template>
    <div class="sip-phone">
      <div class="phone-body">
        <div class="phone-screen">
          <input v-model="phoneNumber" placeholder="Marca un número" :disabled="callInProgress || incomingCall" class="number-input" />
          <div class="status">{{ status }}</div>
        </div>
  
        <div class="dial-pad">
          <button v-for="digit in dialPad" :key="digit" @click="dial(digit)" :disabled="callInProgress || incomingCall" class="dial-button">
            {{ digit }}
          </button>
        </div>
  
        <div class="call-controls">
          <button @click="makeCall" :disabled="!phoneNumber || callInProgress || incomingCall" class="call-button">
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
      };
    },
    mounted() {
      this.detectDevices();
      this.initializeSIP();
      setInterval(this.detectDevices, 10000);
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
      async initializeSIP() {
        const sipServer = import.meta.env.VITE_SIP_SERVER || 'wss://webrtc.soportedinamico.com:8089/ws';
        const sipUser = import.meta.env.VITE_SIP_USER; // Ejemplo: "4012"
        const sipPassword = import.meta.env.VITE_SIP_PASSWORD;
  
        this.log(`Iniciando conexión a ${sipServer} con usuario ${sipUser}`);
        const uri = SIP.UserAgent.makeURI(`sip:${sipUser}@webrtc.soportedinamico.com`);
  
        const configuration = {
          uri,
          transportOptions: {
            wsServers: [sipServer],
            traceSip: true,
            connectionTimeout: 15,
            reconnectionAttempts: 999,
            reconnectionTimeout: 3,
          },
          authorizationUsername: sipUser,
          authorizationPassword: sipPassword,
          register: true, // Registro automático como en tu versión y phone.js
          userAgentString: `Browser Phone 0.3.29 (SIPJS - 0.20.0)`,
          registerOptions: {
            expires: 300, // Igual a RegisterExpires en phone.js
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
  
        this.ua = new SIP.UserAgent(configuration);
  
        // Manejadores de transporte
        this.ua.transport.onConnect = () => {
          this.status = 'Conectado';
          this.log('Transporte WebSocket conectado');
        };
        this.ua.transport.onDisconnect = error => {
          this.status = 'Desconectado';
          this.log(`Transporte desconectado: ${error?.message || 'Desconocido'}`);
        };
        this.ua.transport.onMessage = message => {
          this.log(`Mensaje SIP recibido: ${message}`);
        };
  
        // Manejo de invitaciones como en phone.js
        this.ua.delegate = {
          onInvite: invitation => {
            this.log(`Llamada entrante recibida de ${invitation.remoteIdentity.uri.user}`);
            this.incomingCall = true;
            this.incomingSession = invitation;
            this.incomingCaller = invitation.remoteIdentity.uri.user || 'Desconocido';
            this.status = 'Llamada entrante';
  
            // Configurar listeners inmediatamente
            this.setupSessionListeners(invitation);
  
            // Loggear detalles de la invitación
            this.log(`Detalles de la invitación: ${JSON.stringify(invitation.request.toJSON())}`);
          },
        };
  
        try {
          await this.ua.start();
          this.log('Conexión SIP establecida');
        } catch (error) {
          this.status = 'Error de conexión';
          this.log(`Error al iniciar UserAgent: ${error.message}`);
        }
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
          this.callInProgress = true;
          this.incomingCall = false;
          this.incomingSession = null;
          this.status = 'En llamada';
          this.log('Llamada entrante aceptada');
        } catch (error) {
          this.status = 'Error al aceptar';
          this.log(`Error al aceptar llamada: ${error.message}`);
          this.cleanupStream();
        }
      },
      rejectCall() {
        if (!this.incomingSession) {
          this.log('No hay sesión entrante para rechazar');
          return;
        }
        this.log('Rechazando llamada entrante');
        try {
          this.incomingSession.reject();
          this.incomingCall = false;
          this.incomingSession = null;
          this.status = 'Conectado';
          this.log('Llamada entrante rechazada');
        } catch (error) {
          this.log(`Error al rechazar llamada: ${error.message}`);
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
          } else if (state === SIP.SessionState.Initial) {
            this.log('Sesión en estado inicial');
          } else if (state === SIP.SessionState.Establishing) {
            this.log('Estableciendo sesión');
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
    },
  };
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
  </style>