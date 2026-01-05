// Vercel serverless entrypoint.
// - In production (Vercel), DO NOT bind a port; export the Express app.
// - Locally, you can still run `NODE_ENV=development node server.js` after `npm run build`.
import app from './dist/backend/src/app.js';

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server running locally on ${PORT}`));
}

export default app;
