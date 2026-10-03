import fs from 'fs';
const buf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==', 'base64');
const publicDir = new URL('../public/', import.meta.url);
fs.writeFileSync(new URL('pwa-192x192.png', publicDir), buf);
fs.writeFileSync(new URL('pwa-512x512.png', publicDir), buf);
