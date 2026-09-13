import { registerSW } from 'virtual:pwa-register';

/**
 * Rejestracja service workera (vite-plugin-pwa, registerType: 'autoUpdate').
 * W dev buildzie plugin dostarcza no-op, więc wywołanie jest bezpieczne wszędzie.
 */
export function registerServiceWorker(): void {
  registerSW({ immediate: true });
}
