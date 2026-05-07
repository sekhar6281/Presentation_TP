const puppeteer  = require('puppeteer-core');
const http       = require('http');
const fs         = require('fs');
const path       = require('path');
const { execSync } = require('child_process');

const CHROME  = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FRAMES  = path.join(__dirname, '_frames');
const OUTPUT  = path.join(__dirname, 'presentation_en.mp4');
const W = 1440, H = 810;
const PORT = 9999;

// Exact durations from audio files (ms)
const SLIDE_MS = [18456, 14064, 13512, 17952, 16128, 17856, 17112, 18528, 18408, 15720, 21048];

/* ── simple static file server ── */
function startServer() {
  const mime = { '.html':'text/html','.css':'text/css','.js':'application/javascript',
                 '.mp3':'audio/mpeg','.mp4':'video/mp4','.json':'application/json',
                 '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg' };
  const server = http.createServer((req, res) => {
    const file = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(PORT, () => { console.log(`Server → http://localhost:${PORT}`); r(server); }));
}

async function main() {
  if (fs.existsSync(FRAMES)) fs.rmSync(FRAMES, { recursive: true });
  fs.mkdirSync(FRAMES);

  const server = await startServer();

  console.log('Launching Chrome…');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [`--window-size=${W},${H}`, '--no-sandbox',
           '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding',
           '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: W, height: H },
  });

  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0' });

  // Stop auto-advance, apply English
  await page.evaluate(() => {
    clearTimeout(window.timer);
    cancelAnimationFrame(window.barAnim);
    applyTranslations('en');
    document.getElementById('btnEn').classList.add('active');
    document.getElementById('btnTe').classList.remove('active');
  });
  await new Promise(r => setTimeout(r, 600));

  const client = await page.createCDPSession();
  let frameCount = 0;
  const timestamps = [];

  client.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    fs.writeFileSync(path.join(FRAMES, `f${String(frameCount).padStart(6,'0')}.jpg`),
                     Buffer.from(data, 'base64'));
    timestamps.push(metadata.timestamp);
    frameCount++;
    await client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    if (frameCount % 30 === 0)
      process.stdout.write(`\r  Frames: ${frameCount} (~${(frameCount/30).toFixed(1)}s)`);
  });

  await client.send('Page.startScreencast', {
    format: 'jpeg', quality: 92,
    maxWidth: W, maxHeight: H, everyNthFrame: 1,
  });

  // Record each slide for its exact audio duration
  for (let i = 0; i < SLIDE_MS.length; i++) {
    console.log(`\nSlide ${i+1}/11  (${(SLIDE_MS[i]/1000).toFixed(1)}s)…`);
    await page.evaluate((idx) => {
      document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
      const slide = document.getElementById(`slide${idx + 1}`);
      slide.classList.add('active');
      // Trigger count-up for slide 10
      if (idx === 9) {
        document.querySelectorAll('#slide10 .s10-stat-val').forEach(el => {
          el.textContent = '0' + (el.dataset.suffix || '');
        });
        setTimeout(() => { if (typeof animateCountUp === 'function') animateCountUp(); }, 2800);
      }
    }, i);
    await new Promise(r => setTimeout(r, SLIDE_MS[i]));
  }

  await client.send('Page.stopScreencast');
  await browser.close();
  server.close();
  console.log(`\n  Total frames: ${frameCount}`);

  /* ── build ffconcat for video ── */
  let concat = 'ffconcat version 1.0\n';
  for (let i = 0; i < frameCount; i++) {
    const dur = i < frameCount - 1
      ? (timestamps[i+1] - timestamps[i]).toFixed(6)
      : '0.033333';
    concat += `file 'f${String(i).padStart(6,'0')}.jpg'\nduration ${dur}\n`;
  }
  const concatVideo = path.join(FRAMES, 'concat_video.txt');
  fs.writeFileSync(concatVideo, concat);

  /* ── build ffconcat for audio ── */
  const audioLines = SLIDE_MS.map((_, i) => {
    const num = String(i+1).padStart(2,'0');
    return `file '${path.join(__dirname,'audio',`en_${num}.mp3`).replace(/\\/g,'/')}'`;
  }).join('\n');
  const concatAudio = path.join(FRAMES, 'concat_audio.txt');
  fs.writeFileSync(concatAudio, audioLines);

  /* ── encode video ── */
  const videoOnly = path.join(FRAMES, 'video_only.mp4');
  console.log('\nEncoding video…');
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatVideo}" ` +
    `-vf "scale=${W}:${H}:flags=lanczos" ` +
    `-c:v libx264 -pix_fmt yuv420p -crf 18 -preset fast "${videoOnly}"`,
    { stdio: 'inherit' }
  );

  /* ── merge audio ── */
  console.log('Merging audio…');
  execSync(
    `ffmpeg -y -i "${videoOnly}" ` +
    `-f concat -safe 0 -i "${concatAudio}" ` +
    `-c:v copy -c:a aac -b:a 192k -shortest "${OUTPUT}"`,
    { stdio: 'inherit' }
  );

  fs.rmSync(FRAMES, { recursive: true });
  console.log(`\n✓  Done!  →  ${OUTPUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
