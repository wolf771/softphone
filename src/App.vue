<template>
  <div id="app">
    <SipPhone />
    <!-- Se eliminó el botón de historial de llamadas -->
  </div>
</template>

<script>
import SipPhone from './components/SipPhone.vue';

export default {
  name: 'App',
  components: {
    SipPhone,
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  margin: 0;
  padding: 0;
  background: #1a1a1a;
}

.title {
  font-size: 2em;
  margin-bottom: 20px;
  text-align: center;
  width: 100%;
}
</style>