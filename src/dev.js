import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';

const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

const HOST = process.env.HOST || '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log('\n\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════════════════════');
  console.log('\x1b[1m\x1b[36m%s\x1b[0m', '  🛡️  RIMUBUSCA - PLATAFORMA INTERNA DE INTELIGÊNCIA OSINT  🛡️');
  console.log('\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════════════════════');
  console.log(`  🌐 Servidor Local Ativo: \x1b[32m${APP_URL}\x1b[0m`);
  console.log(`  🔐 Autenticação:       \x1b[34m${APP_URL}/login\x1b[0m`);
  console.log(`  🩺 Health Check:        \x1b[34m${APP_URL}/api/health\x1b[0m`);
  console.log(`  ⚙️  Modo de Execução:    \x1b[33m${process.env.NODE_ENV || 'development'}\x1b[0m`);
  console.log('\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════════════════════\n');
});

// Encerramento Gracioso (Graceful Shutdown)
process.on('SIGTERM', () => {
  console.log('Recebido SIGTERM, encerrando servidor HTTP com segurança...');
  server.close(() => {
    console.log('Servidor encerrado.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nEncerrando servidor...');
  server.close(() => {
    process.exit(0);
  });
});

