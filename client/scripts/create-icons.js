// Renders public/favicon.svg to the PWA PNG icons (192 and 512 px) with headless Chromium.
// Usage: node scripts/create-icons.js   (set PW_CHROMIUM_PATH to use an installed Chrome)
import fs from 'fs';
import { chromium } from '@playwright/test';

const publicDir = new URL('../public/', import.meta.url);
const svg = fs.readFileSync(new URL('favicon.svg', publicDir), 'utf8');

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const page = await browser.newPage();
for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  const png = await page.locator('svg').screenshot({ omitBackground: true });
  fs.writeFileSync(new URL(`pwa-${size}x${size}.png`, publicDir), png);
}
await browser.close();
console.log('Wrote pwa-192x192.png and pwa-512x512.png');
