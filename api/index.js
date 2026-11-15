import app from '../src/app.js';

/**
 * Entrypoint serverless para deploy na Vercel via @vercel/node.
 * O Vercel gerencia as requisições HTTP passando-as diretamente para a aplicação Express.
 */
export default app;

