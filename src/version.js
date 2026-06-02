// Build metadata. Overwritten by CI at deploy time with the short commit
// hash; locally / in tests this stays as `dev`. Surfaced in the HUD so the
// user can confirm which version of the app the browser is actually running
// (helps diagnose CDN/cache lag on github.io).
export const VERSION = 'dev';
