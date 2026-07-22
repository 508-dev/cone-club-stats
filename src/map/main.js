import '../shared/theme.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// leaflet.heat is a UMD plugin that expects a global `L` to attach itself to.
window.L = L;
await import('leaflet.heat');

import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app') });
export default app;
