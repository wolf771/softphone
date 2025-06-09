import './assets/main.css'

import { createApp } from 'vue';
import App from './App.vue';

// FontAwesome
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { 
    faPhone, 
    faPhoneSlash, 
    faPlay, 
    faPause, 
    faShareSquare, 
    faSync, 
    faExclamationTriangle, 
    faSignal, 
    faTrashAlt, 
    faChevronRight, 
    faChevronLeft, 
    faPhoneAlt, 
    faPhoneVolume, 
    faCopy,
    // Add new icons
    faUserPlus,
    faUserMinus,
    faTimes,
    faChevronDown,
    faChevronUp,
    faUsers, // Agregar ícono para conferencia
    faCog, // Icono de configuración (engranaje)
} from '@fortawesome/free-solid-svg-icons';

// Add icons to the library
library.add(
    faPhone, 
    faPhoneSlash, 
    faPlay, 
    faPause, 
    faShareSquare, 
    faSync, 
    faExclamationTriangle, 
    faSignal, 
    faTrashAlt, 
    faChevronRight, 
    faChevronLeft, 
    faPhoneAlt, 
    faPhoneVolume, 
    faCopy,
    // Add new icons
    faUserPlus,
    faUserMinus,
    faTimes,
    faChevronDown,
    faChevronUp,
    faUsers, // Agregar ícono para conferencia
    faCog, // Icono de configuración (engranaje)
);

const app = createApp(App);

// Register the FontAwesomeIcon component globally
app.component('font-awesome-icon', FontAwesomeIcon);

app.mount('#app');