// This stub exposes the global WebSdk object to Vite bundler to prevent require('WebSdk') errors
const WebSdk = window.WebSdk || globalThis.WebSdk || {};
export default WebSdk;
export { WebSdk };
