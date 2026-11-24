import { createWorker } from 'tesseract.js';
import ocrWorker from 'tesseract.js/dist/worker.min.js?url';
import ocrCore from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url';
import language from '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?url';

const get = id => document.getElementById(id);
const canvas = document.createElement('canvas');
canvas.setAttribute('aria-label', 'Captura editable. Arrastrá para tapar un área.');
const ctx = canvas.getContext('2d');
let source, start, preview;
let marks = [];
let revision = 0;

function draw() {
  if (!source) return;
  ctx.drawImage(source, 0, 0);
  ctx.fillStyle = '#000';
  for (const [x, y, w, h] of marks) ctx.fillRect(x, y, w, h);
  if (preview) ctx.fillRect(...preview);
  get('undo').disabled = marks.length === 0;
}

async function load(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return;
  try {
    const image = await createImageBitmap(file);
    if (image.width * image.height > 24_000_000) {
      image.close();
      throw new Error();
    }
    source?.close();
    source = image;
    revision++;
    marks = [];
    start = preview = null;
    canvas.width = image.width;
    canvas.height = image.height;
    get('stage').replaceChildren(canvas);
    get('suggestions').replaceChildren();
    for (const id of ['detect', 'copy', 'download']) get(id).disabled = false;
    draw();
    get('status').textContent = 'Arrastrá sobre la imagen para tapar un área. Revisá el resultado antes de compartir.';
  } catch {
    get('status').textContent = 'No se pudo abrir la imagen. Usá PNG, JPEG o WebP de hasta 24 megapíxeles.';
  }
}

get('file').onchange = event => load(event.target.files[0]);
document.addEventListener('paste', event => {
  const file = [...event.clipboardData.files].find(item => item.type.startsWith('image/'));
  if (file) { event.preventDefault(); load(file); }
});
function point(event) {
  const bounds = canvas.getBoundingClientRect();
  return [
    Math.max(0, Math.min(canvas.width, (event.clientX - bounds.left) * canvas.width / bounds.width)),
    Math.max(0, Math.min(canvas.height, (event.clientY - bounds.top) * canvas.height / bounds.height)),
  ];
}
canvas.onpointerdown = event => {
  if (!event.isPrimary || event.button !== 0) return;
  start = point(event);
  canvas.setPointerCapture(event.pointerId);
};
canvas.onpointermove = event => {
  if (!start || !event.isPrimary) return;
  const [x, y] = point(event);
  const left = Math.floor(Math.min(start[0], x));
  const top = Math.floor(Math.min(start[1], y));
  preview = [left, top, Math.ceil(Math.max(start[0], x)) - left, Math.ceil(Math.max(start[1], y)) - top];
  draw();
};
canvas.onpointerup = event => {
  if (!start || !event.isPrimary) return;
  canvas.onpointermove(event);
  if (preview[2] > 1 && preview[3] > 1) marks.push(preview);
  start = preview = null;
  draw();
};
canvas.onpointercancel = () => { start = preview = null; draw(); };
get('undo').onclick = () => { marks.pop(); draw(); };

function png() {
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;
  const render = output.getContext('2d');
  render.drawImage(source, 0, 0);
  render.fillStyle = '#000';
  for (const mark of marks) render.fillRect(...mark);
  return new Promise((resolve, reject) => output.toBlob(blob => blob ? resolve(blob) : reject(new Error()), 'image/png'));
}
get('download').onclick = async () => {
  try {
    const url = URL.createObjectURL(await png());
    const link = Object.assign(document.createElement('a'), { href: url, download: 'safe-capture.png' });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch { get('status').textContent = 'No se pudo exportar el PNG.'; }
};
get('copy').onclick = async () => {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png() })]);
    get('status').textContent = 'PNG copiado.';
  } catch { get('status').textContent = 'No se pudo copiar. Usá Descargar PNG.'; }
};

get('detect').onclick = async () => {
  const version = revision;
  const capture = await png().catch(() => null);
  if (!capture || version !== revision) return;
  get('detect').disabled = true;
  get('status').textContent = 'Buscando texto en tu equipo…';
  get('suggestions').replaceChildren();
  let worker;
  try {
    const langPath = new URL('.', new URL(language, location.href)).href;
    worker = await createWorker('eng', 1, { workerPath: ocrWorker, corePath: ocrCore, langPath, workerBlobURL: false });
    const { data } = await worker.recognize(capture, {}, { blocks: true });
    if (version !== revision) return;
    let count = 0;
    for (const block of data.blocks ?? []) for (const paragraph of block.paragraphs) for (const line of paragraph.lines) {
      const email = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(line.text);
      const phone = /(?:\+?\d[ ().-]*){8,15}/.test(line.text);
      if (!email && !phone) continue;
      const { x0, y0, x1, y1 } = line.bbox;
      const item = document.createElement('li');
      item.textContent = `Posible ${email ? 'correo' : 'teléfono'} cerca de la fila ${y0} px.`;
      const button = document.createElement('button');
      button.textContent = 'Tapar línea';
      button.onclick = () => {
        marks.push([x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8]);
        item.remove();
        draw();
      };
      item.append(button);
      get('suggestions').append(item);
      count++;
    }
    get('status').textContent = `${count} sugerencias. Revisá también la captura a mano.`;
  } catch {
    if (version === revision) get('status').textContent = 'No se pudo ejecutar la detección. Podés marcar las áreas a mano.';
  } finally {
    await worker?.terminate();
    if (version === revision) get('detect').disabled = false;
  }
};
