export async function exportTranscript(result, format = 'txt', fileName = 'transcript') {
  const segments = Array.isArray(result) ? result : result.segments || [];
  const safeName = sanitize(fileName);

  switch (format) {
    case 'txt': {
      const content = segments
        .map((s) => `[${formatTime(s.startTime)} - ${formatTime(s.endTime)}] ${s.speaker}: ${s.text}`)
        .join('\n\n');
      downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), `${safeName}.txt`);
      break;
    }
    case 'srt': {
      const content = segments
        .map((s, idx) => `${idx + 1}\n${formatSrtTime(s.startTime)} --> ${formatSrtTime(s.endTime)}\n${s.speaker}: ${s.text}\n`)
        .join('\n');
      downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), `${safeName}.srt`);
      break;
    }
    case 'json': {
      const content = JSON.stringify(transform(segments), null, 2);
      downloadBlob(new Blob([content], { type: 'application/json' }), `${safeName}.json`);
      break;
    }
    case 'docx': {
      const { Document, Packer, Paragraph, TextRun } = await import('https://esm.sh/docx@9.1.0');
      const doc = new Document({
        sections: [
          {
            children: segments.map(
              (s) =>
                new Paragraph({
                  children: [
                    new TextRun({ text: `[${formatTime(s.startTime)}] ${s.speaker}: `, bold: true }),
                    new TextRun({ text: s.text }),
                  ],
                })
            ),
          },
        ],
      });
      downloadBlob(await Packer.toBlob(doc), `${safeName}.docx`);
      break;
    }
    case 'pdf': {
      downloadBlob(await buildPdfBlob(segments), `${safeName}.pdf`);
      break;
    }
    case 'zip': {
      const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default || (await import('https://esm.sh/jszip@3.10.1'));
      const zip = new JSZip();
      zip.file(
        `${safeName}.txt`,
        segments.map((s) => `${s.speaker}: ${s.text}`).join('\n')
      );
      zip.file(`${safeName}.json`, JSON.stringify(transform(segments), null, 2));
      const srt = segments
        .map((s, idx) => `${idx + 1}\n${formatSrtTime(s.startTime)} --> ${formatSrtTime(s.endTime)}\n${s.speaker}: ${s.text}\n`)
        .join('\n');
      zip.file(`${safeName}.srt`, srt);
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${safeName}.zip`);
      break;
    }
    default:
      throw new Error(`Unknown export format: ${format}`);
  }
}

export function transform(segments) {
  return {
    generatedAt: new Date().toISOString(),
    segmentCount: segments.length,
    segments,
  };
}

const BANGLA_FONT_PATH = '/app/fonts/NotoSansBengali-Regular.ttf';
const BANGLA_FONT_FILE = 'NotoSansBengali-Regular.ttf';
const BANGLA_FONT_NAME = 'NotoBengali';

let banglaFontBase64 = null;

export async function loadBanglaFont() {
  if (banglaFontBase64) return banglaFontBase64;
  const res = await fetch(BANGLA_FONT_PATH);
  if (!res.ok) throw new Error(`Bangla font could not be loaded (HTTP ${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  banglaFontBase64 = btoa(binary);
  return banglaFontBase64;
}

async function embedBanglaFont(doc) {
  const base64 = await loadBanglaFont();
  doc.addFileToVFS(BANGLA_FONT_FILE, base64);
  doc.addFont(BANGLA_FONT_FILE, BANGLA_FONT_NAME, 'normal');
}

export async function buildPdfBlob(segments) {
  const { jsPDF } = await import('https://esm.sh/jspdf@2.5.2');
  const doc = new jsPDF();
  let usedFont = 'helvetica';
  try {
    await embedBanglaFont(doc);
    usedFont = BANGLA_FONT_NAME;
  } catch (err) {
    console.warn('[exporter] Bangla font unavailable, using helvetica:', err.message);
  }
  doc.setFont(usedFont, 'normal');
  let y = 12;
  for (const s of segments) {
    const heading = doc.splitTextToSize(`[${formatTime(s.startTime)}] ${s.speaker}:`, 185);
    const body = doc.splitTextToSize(String(s.text || ''), 185);
    const lines = heading.length + body.length;
    if (y + lines * 5 + 5 > 282) {
      doc.addPage();
      y = 12;
    }
    doc.setFontSize(9);
    doc.setFont(usedFont, 'bold');
    doc.text(heading, 10, y);
    y += heading.length * 5 + 1;
    doc.setFont(usedFont, 'normal');
    doc.text(body, 10, y);
    y += body.length * 5 + 5;
  }
  return doc.output('blob');
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function sanitize(name) {
  return String(name || 'transcript')
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .slice(0, 80) || 'transcript';
}

export function formatTime(sec) {
  const clean = Math.max(0, Number(sec) || 0);
  const m = Math.floor(clean / 60);
  const s = Math.floor(clean % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatSrtTime(sec) {
  const clean = Math.max(0, Number(sec) || 0);
  const h = Math.floor(clean / 3600);
  const m = Math.floor((clean % 3600) / 60);
  const s = Math.floor(clean % 60);
  const ms = Math.floor((clean % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}