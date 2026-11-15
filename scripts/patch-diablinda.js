import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const headersPath = path.join(rootDir, 'node_modules/diablinda/src/core/headers.js');
const indexPath = path.join(rootDir, 'node_modules/diablinda/src/index.js');

try {
  if (fs.existsSync(headersPath)) {
    let content = fs.readFileSync(headersPath, 'utf-8');
    if (!content.includes('getRandomUserAgent')) {
      content += `\n\n/**\n * Retorna uma string User-Agent aleatória de navegador moderno.\n * @returns {string}\n */\nexport function getRandomUserAgent() {\n  return typeof getRandomProfile === 'function' ? getRandomProfile().ua : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';\n}\n`;
      fs.writeFileSync(headersPath, content, 'utf-8');
      console.log('✅ [PATCH] diablinda/src/core/headers.js patched with getRandomUserAgent.');
    }
  }

  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf-8');
    // Caso por algum motivo headers.js continue falhando, protege o index.js
    if (!fs.existsSync(headersPath) || !fs.readFileSync(headersPath, 'utf-8').includes('getRandomUserAgent')) {
      content = content.replace(
        "export { getBrowserHeaders, getRandomUserAgent } from './core/headers.js';",
        "export { getBrowserHeaders } from './core/headers.js';\nexport function getRandomUserAgent() { return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'; }"
      );
      fs.writeFileSync(indexPath, content, 'utf-8');
      console.log('✅ [PATCH] diablinda/src/index.js export fallback applied.');
    }
  }
} catch (err) {
  console.warn('⚠️ [PATCH WARNING] patch-diablinda:', err.message);
}
