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
  text-align: center;
  margin-top: 60px;
}

.title {
  font-size: 2em;
  margin-bottom: 20px;
  text-align: center;
  width: 100%;
}
</style>