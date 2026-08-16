import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

// `onUnhandledRequest: 'error'` est délibéré : tout appel réseau non simulé fait
// échouer le test au lieu de partir vers l'extérieur. C'est ce qui garantit
// qu'aucun test ne dépend de la disponibilité de Fake Store API.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
