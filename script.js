const LIMITS = { nMin: 1, nMax: 16, bMin: 1, bMax: 8 };
const SPEED_OF_SOUND = 343; // m/s

// ---- Test settings: replace with the three tests from your instructor's sheet ----
const TESTS = [
  { name: "A", f: 440,  a: 1,   n: 8, b: 3 },
  { name: "B", f: 200,  a: 0.5, n: 4, b: 2 },
  { name: "C", f: 1000, a: 1,   n: 4, b: 2 }
];

const $ = id => document.getElementById(id);
let last = null;

function readInputs() {
  const raw = id => $(id).value.trim();
  return { f: raw("freq") === "" ? NaN : Number(raw("freq")),
           a: raw("amp")  === "" ? NaN : Number(raw("amp")),
           n: raw("n")    === "" ? NaN : Number(raw("n")),
           b: raw("bits") === "" ? NaN : Number(raw("bits")) };
}

function validate({ f, a, n, b }) {
  const w = [];
  if (!isFinite(f) || f <= 0) w.push("Frequency must be a number greater than 0.");
  if (!isFinite(a) || a < 0 || a > 1) w.push("Amplitude must be a number from 0 to 1.");
  if (!Number.isInteger(n) || n < LIMITS.nMin || n > LIMITS.nMax) w.push(Samples must be a whole number from ${LIMITS.nMin} to ${LIMITS.nMax}.);
  if (!Number.isInteger(b) || b < LIMITS.bMin || b > LIMITS.bMax) w.push(Bits must be a whole number from ${LIMITS.bMin} to ${LIMITS.bMax}.);
  return w;
}

function compute({ f, a, n, b }) {
  const periodMs = 1000 / f;
  const wavelength = SPEED_OF_SOUND / f;
  const levels = 2 ** b;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const t = i * periodMs / n;
    let amp = a * Math.sin(2 * Math.PI * i / n);
    amp = Math.round(amp * 1e9) / 1e9;           // removes tiny float noise
    const level = Math.round((amp + 1) / 2 * (levels - 1));
    rows.push({ num: i + 1, t, amp, level, bin: level.toString(2).padStart(b, "0") });
  }
  return { f, a, n, b, periodMs, wavelength, levels, rows,
           binary: rows.map(r => r.bin).join(""), totalBits: n * b };
}

const fmtWave = m => m < 1 ? ${m.toFixed(3)} m (${(m * 100).toFixed(1)} cm) : ${m.toFixed(3)} m;
const fix2 = x => (Math.abs(x) < 0.005 ? 0 : x).toFixed(2);

function showWarnings(list) {
  const box = $("warn");
  if (!list.length) { box.style.display = "none"; box.innerHTML = ""; return; }
  box.innerHTML = "<strong>Please fix these:</strong><ul>" + list.map(m => <li>${m}</li>).join("") + "</ul>";
  box.style.display = "block";
}

function drawWave(r) {
  const cv = $("cv"), dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext("2d"); c.scale(dpr, dpr); c.clearRect(0, 0, W, H);
  const padY = 22, mid = H / 2, scale = mid - padY;
  const X = p => p * W;                        // wave runs edge to edge
  const Y = v => mid - v * scale;
  // zero line
  c.strokeStyle = "rgba(107,31,75,.18)"; c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, mid); c.lineTo(W, mid); c.stroke();
  // smooth wave (one full cycle)
  c.strokeStyle = "#8a4fd0"; c.lineWidth = 2.5; c.lineJoin = "round"; c.beginPath();
  for (let k = 0; k <= 300; k++) {
    const p = k / 300, v = r.a * Math.sin(2 * Math.PI * p);
    k ? c.lineTo(X(p), Y(v)) : c.moveTo(X(p), Y(v));
  }
  c.stroke();
  // stems from the zero line up or down to each sample
  c.strokeStyle = "rgba(232,85,159,.55)"; c.lineWidth = 2;
  r.rows.forEach((row, i) => {
    c.beginPath(); c.moveTo(X(i / r.n), mid); c.lineTo(X(i / r.n), Y(row.amp)); c.stroke();
  });
  // sample dots
  c.fillStyle = "#e8559f";
  r.rows.forEach((row, i) => {
    c.beginPath(); c.arc(X(i / r.n), Y(row.amp), 5.5, 0, 7); c.fill();
  });
}

function renderConverter(r) {
  $("fa").textContent = r.a;
  $("ff").textContent = r.f + " Hz";
  $("fp").textContent = r.periodMs.toFixed(2) + " ms";
  $("fw").textContent = fmtWave(r.wavelength);
  $("tbl").innerHTML = "<tr><th>Sample #</th><th>Time (ms)</th><th>Amplitude</th><th>Level</th><th>Binary</th></tr>" +
    r.rows.map(x => <tr><td>${x.num}</td><td>${x.t.toFixed(2)}</td><td>${fix2(x.amp)}</td><td>${x.level}</td><td><code>${x.bin}</code></td></tr>).join("");
  $("bin").textContent = r.binary;
  $("total").textContent = r.totalBits;
  $("out").hidden = false;
  drawWave(r);
}

function convert() {
  const inp = readInputs(), warnings = validate(inp);
  showWarnings(warnings);
  if (warnings.length) { $("out").hidden = true; last = null; return; }
  last = compute(inp);
  renderConverter(last);
}

function renderTests() {
  $("tests").innerHTML = "<tr><th>Test</th><th>Frequency</th><th>Amplitude</th><th>Samples</th><th>Bits</th><th>Period</th><th>Wavelength</th><th>Total bits</th><th>Binary result</th></tr>" +
    TESTS.map(t => {
      const r = compute(t);
      return <tr><td>${t.name}</td><td>${t.f} Hz</td><td>${t.a}</td><td>${t.n}</td><td>${t.b}</td><td>${r.periodMs.toFixed(2)} ms</td><td>${fmtWave(r.wavelength)}</td><td>${r.totalBits}</td><td><code style="word-break:break-all">${r.binary}</code></td></tr>;
    }).join("");
}

// Bonus: play the tone for 1 second (low volume)
function playTone() {
  const inp = readInputs();
  if (!isFinite(inp.f) || inp.f <= 0) { showWarnings(["Frequency must be a number greater than 0."]); return; }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  const vol = 0.15 * (isFinite(inp.a) ? Math.min(Math.max(inp.a, 0), 1) : 1);
  osc.frequency.value = Math.min(inp.f, 20000);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02);
  gain.gain.setValueAtTime(vol, ctx.currentTime + 0.95);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
  osc.connect(gain).connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 1);
  osc.onended = () => ctx.close();
}

$("convert").addEventListener("click", convert);
$("play").addEventListener("click", playTone);
document.querySelectorAll("input").forEach(el => el.addEventListener("keydown", e => { if (e.key === "Enter") convert(); }));
window.addEventListener("resize", () => { if (last) drawWave(last); });
renderTests();
convert();
