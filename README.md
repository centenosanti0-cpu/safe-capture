# Safe Capture

Paste a screenshot, draw solid redactions, and export a new PNG. Optional on-device OCR suggests lines containing possible emails and phone numbers. No account or API key is required.

## Install and run

With Node.js 24 installed, run `npm ci` and `npm run dev`. Open the localhost URL printed by Vite. Use `npm run build` to produce the static site in `dist/` and serve that directory over HTTP(S).

## Use it

1. Paste a capture or select a PNG, JPEG or WebP.
2. Drag over anything sensitive. Use **Buscar correos y teléfonos** to review optional suggestions, then click **Tapar línea** on each one you want to hide.
3. Check the image visually. Download or copy the PNG.

The redactions replace pixels in the exported PNG. They do not change the original, and the export does not copy source metadata. OCR is approximate and can miss personal information. Clipboard export depends on browser support and requires localhost or HTTPS. The application serves OCR assets alongside the site and does not send the screenshot to a remote recognition service.
