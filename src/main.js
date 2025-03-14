import './assets/main.css'

import { createApp } from 'vue';
import App from './App.vue';

// FontAwesome
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faPhone, faPhoneSlash, faPlay, faPause, faShareSquare, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';

// Agregar íconos a la biblioteca

library.add(faPhone, faPhoneSlash, faPlay, faPause, faShareSquare, faCheck, faTimes);
const app = createApp(App);
app.component('font-awesome-icon', FontAwesomeIcon);
app.mount('#app');