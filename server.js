import 'dotenv/config';
import http from 'node:http';
import { createApp } from './src/app.js';
import { config } from './src/config.js';
import db from './src/db.js';
import { schoolNow } from './src/lib/time.js';

const app = await createApp();
const server = http.createServer(app);
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

server.listen(config.port, () => {
  const now = schoolNow();
  console.log('');
  console.log('  Absensi Digital SMA Trinitas');
  console.log(`  Server berjalan di http://localhost:${config.port}`);
  console.log(`  Lingkungan: ${config.nodeEnv} | Waktu sekolah: ${now.date} ${now.time} ${now.timezone}`);
  console.log(`  Database: ${config.databasePath}`);
  if (!config.isProduction) {
    console.log('  Catatan: GPS browser membutuhkan HTTPS, kecuali di localhost.');
  }
  console.log('');
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[server] ${signal} diterima, menutup server...`);
  server.close(() => {
    try {
      db.close();
    } catch {
      // abaikan
    }
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[server] Penutupan terlalu lama, keluar paksa.');
    try {
      db.close();
    } catch {
      // abaikan
    }
    process.exit(1);
  }, 8000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (error) => {
  console.error('[server] Unhandled rejection:', error);
});
