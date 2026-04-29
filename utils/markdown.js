// utils/markdown.js — minimal Markdown helpers.
//
// Aria's brief always comes back in a known, well-bounded subset of Markdown:
//   # Heading 1
//   ## Heading 2
//   **bold inline**
//   - bullet
//   paragraphs separated by blank line
//
// We avoid pulling in a markdown library and parse this tight subset ourselves
// for both the in-app render and the PDF render.

// Convert a tight Markdown subset to a plain ordered list of typed blocks.
// Block: { type: 'h1' | 'h2' | 'h3' | 'p' | 'ul', text? : string, items?: string[] }
export function parseBlocks(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  let bullets = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'p', text: para.join(' ').trim() });
      para = [];
    }
  };
  const flushBullets = () => {
    if (bullets) {
      blocks.push({ type: 'ul', items: bullets });
      bullets = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); flushBullets(); continue; }
    if (line.startsWith('### ')) { flushPara(); flushBullets(); blocks.push({ type: 'h3', text: line.slice(4) }); continue; }
    if (line.startsWith('## ')) { flushPara(); flushBullets(); blocks.push({ type: 'h2', text: line.slice(3) }); continue; }
    if (line.startsWith('# ')) { flushPara(); flushBullets(); blocks.push({ type: 'h1', text: line.slice(2) }); continue; }
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      bullets = bullets || [];
      bullets.push(line.replace(/^[-*]\s+/, ''));
      continue;
    }
    flushBullets();
    para.push(line);
  }
  flushPara();
  flushBullets();
  return blocks;
}

// Render bold spans (**text**) inside a string, returning an array of
// { text, bold } chunks for use in React Text rendering.
export function parseInline(s) {
  const out = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), bold: false });
  return out;
}

// Convert markdown → clean printable HTML for expo-print.
// Black on white. Serif body. No color, no decoration. Looks like a clinical note.
export function markdownToHtml(md) {
  const blocks = parseBlocks(md);
  const escape = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const inline = (s) => parseInline(s).map((p) =>
    p.bold ? `<strong>${escape(p.text)}</strong>` : escape(p.text)
  ).join('');

  const body = blocks.map((b) => {
    if (b.type === 'h1') return `<h1>${inline(b.text)}</h1>`;
    if (b.type === 'h2') return `<h2>${inline(b.text)}</h2>`;
    if (b.type === 'h3') return `<h3>${inline(b.text)}</h3>`;
    if (b.type === 'ul') return `<ul>${b.items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`;
    return `<p>${inline(b.text)}</p>`;
  }).join('\n');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Pre-Visit Brief</title>
    <style>
      @page { margin: 0.7in; }
      html, body { color: #111; background: #fff; }
      body {
        font-family: 'Georgia', 'Times New Roman', serif;
        font-size: 11pt;
        line-height: 1.55;
        max-width: 7.1in;
      }
      h1 { font-size: 18pt; margin: 0 0 6pt 0; letter-spacing: -0.3pt; }
      h2 { font-size: 13pt; margin: 14pt 0 4pt 0; border-top: 0.5pt solid #888; padding-top: 8pt; }
      h3 { font-size: 11pt; margin: 10pt 0 2pt 0; font-weight: 600; }
      p { margin: 0 0 8pt 0; }
      ul { margin: 0 0 8pt 18pt; padding: 0; }
      li { margin: 0 0 4pt 0; }
      strong { font-weight: 600; }
    </style>
  </head>
  <body>
${body}
  </body>
</html>`;
}

export default { parseBlocks, parseInline, markdownToHtml };
