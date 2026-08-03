import fs from 'fs';
const buf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('d:/health-sync-engine/health-sync-engine/public/pwa-192x192.png', buf);
fs.writeFileSync('d:/health-sync-engine/health-sync-engine/public/pwa-512x512.png', buf);
