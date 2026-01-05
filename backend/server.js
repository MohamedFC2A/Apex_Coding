// Production entrypoint for Render.com and similar hosts.
// This wrapper keeps `npm start` stable while the TS build outputs to `dist/`.
import './dist/server.js';

