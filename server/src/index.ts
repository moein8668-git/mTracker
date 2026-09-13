import Fastify from 'fastify';
import cors from '@fastify/cors';
import { runMigrations } from './migrate.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerSyncRoutes } from './routes/sync.js';

const fastify = Fastify({
  bodyLimit: 20 * 1024 * 1024,
});

await fastify.register(cors, {
  origin: (process.env.CORS_ORIGIN || '').split(','),
});

await runMigrations();

fastify.get('/api/health', async () => ({ ok: true }));

registerAuthRoutes(fastify);
registerSyncRoutes(fastify);

const port = parseInt(process.env.PORT || '8788');
await fastify.listen({ port, host: '0.0.0.0' });
console.log(`Server listening on ${port}`);
