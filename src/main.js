import { boot } from './app/boot.js';

boot().catch((err) => {
  // Surface boot failures: without this they're swallowed as unhandled
  // promise rejections and the user sees a blank canvas with no clue.
  if (typeof console !== 'undefined') console.error('boot failed:', err);
});
