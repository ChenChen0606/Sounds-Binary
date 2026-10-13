const SPEED_OF_SOUND = 343;         
const N_MIN = 2, N_MAX = 64;        
const B_MIN = 1, B_MAX = 8;          

const TESTS = [
  { name: "A", f: 440, a: 0.8, n: 8, b: 3 },
  { name: "B", f: 200, a: 0.5, n: 6, b: 4 },
  { name: "C", f: 500, a: 0.9, n: 5, b: 3 }
];

const $ = id => document.getElementById(id);
let lastResult = null;
let audioCtx = null;

//  Reading and checking the input
function readNumber(id) {
  const text = $(id).value.trim();
  return text === "" ? NaN : Number(text);
}

function readInputs() {
  return {
    f: readNumber("freq"),
    a: readNumber("amp"),
    n: readNumber("n"),
    b: readNumber("bits"),
    fText: $("freq").value.trim(),   
    aText: $("amp").value.trim()
  };
}

function validate({ f, a, n, b }) {
  const problems = [];
  if (!isFinite(f) || f <= 0)
    problems.push("Frequency must be a number greater than 0.");
  if (!isFinite(a) || a < 0 || a > 1)
    problems.push("Amplitude must be a number from 0 to 1.");
  if (!Number.isInteger(n) || n < N_MIN || n > N_MAX)
    problems.push("Samples must be a whole number from " + N_MIN + " to " + N_MAX + ".");
  if (!Number.isInteger(b) || b < B_MIN || b > B_MAX)
    problems.push("Bits must be a whole number from " + B_MIN + " to " + B_MAX + ".");
  return problems;
}

function showWarnings(list) {
  const box = $("warn");
  if (list.length === 0) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }
  box.innerHTML = "<strong>Please fix these:</strong><ul>" +
    list.map(m => "<li>" + m + "</li>").join("") + "</ul>";
  box.style.display = "block";
}


const roundTo9 = x => Math.round(x * 1e9) / 1e9;   

function compute(f, a, n, b) {
  const periodMs = (1 / f) * 1000;
  const wavelength = SPEED_OF_SOUND / f;
  const levels = Math.pow(2, b);
  const rows = [];

 
  for (let i = 0; i < n; i++) {
    const time = i * periodMs / n;
    const height = roundTo9(a * Math.sin(2 * Math.PI * i / n));
    const level = Math.round(roundTo9((height + 1) / 2 * (levels - 1))); 
    const binary = level.toString(2).padStart(b, "0");
    rows.push({ num: i + 1, time, height, level, binary });
  }

  return {
    f, a, n, b, periodMs, wavelength, levels, rows,
    binary: rows.map(r => r.binary).join(" "),
    totalBits: n * b
  };
}


function formatWavelength(m) {
  if (m >= 1) return m.toFixed(2) + " m";
  return (m * 100).toFixed(1) + " cm";
}

function formatHeight(h) {
  if (Math.abs(h) < 0.005) h = 0;     
  return h.toFixed(2);
}

function drawWave(r) {
  const cv = $("cv");
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const c = cv.getContext("2d");
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);

  const padX = 16, padY = 26, mid = H / 2, scale = mid - padY;
  const X = p => padX + p * (W - 2 * padX);   
  const Y = v => mid - v * scale;            

  c.lineWidth = 1;
  c.strokeStyle = "rgba(255,255,255,.10)";
  [-1, -0.5, 0.5, 1].forEach(v => {
    c.beginPath(); c.moveTo(0, Y(v)); c.lineTo(W, Y(v)); c.stroke();
  });
  c.strokeStyle = "rgba(255,255,255,.35)";
  c.beginPath(); c.moveTo(0, mid); c.lineTo(W, mid); c.stroke();

  c.strokeStyle = "#b79cff";
  c.lineWidth = 3;
  c.lineJoin = "round";
  c.beginPath();
  for (let k = 0; k <= 300; k++) {
    const p = k / 300;
    const v = r.a * Math.sin(2 * Math.PI * p);
    if (k === 0) c.moveTo(X(p), Y(v)); else c.lineTo(X(p), Y(v));
  }
  c.stroke();

  r.rows.forEach((row, i) => {
    const x = X(i / r.n);
    const levelValue = row.level / (r.levels - 1) * 2 - 1;   

    c.strokeStyle = "rgba(255,126,182,.55)";
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, Y(row.height)); c.lineTo(x, Y(levelValue)); c.stroke();

    c.fillStyle = "#ff7eb6";
    c.beginPath(); c.arc(x, Y(row.height), 5.5, 0, Math.PI * 2); c.fill();

    c.strokeStyle = "#ffffff";
    c.lineWidth = 2;
    c.beginPath(); c.arc(x, Y(levelValue), 5.5, 0, Math.PI * 2); c.stroke();
  });
}


function showResult(r, inp) {
  
  $("fa").textContent = inp.aText;
  $("ff").textContent = inp.fText + " Hz";
  $("fp").textContent = r.periodMs.toFixed(2) + " ms";
  $("fw").textContent = formatWavelength(r.wavelength);

  
  let html = "<thead><tr><th>Sample #</th><th>Time (ms)</th><th>Amplitude</th><th>Level</th><th>Binary</th></tr></thead><tbody>";
  r.rows.forEach(x => {
    html += "<tr><td>" + x.num + "</td><td>" + x.time.toFixed(2) + "</td><td>" +
            formatHeight(x.height) + "</td><td>" + x.level + "</td><td><code>" + x.binary + "</code></td></tr>";
  });
  html += "</tbody>";
  $("tbl").innerHTML = html;

  $("bin").textContent = r.binary;
  $("total").textContent = r.totalBits;

  $("out").hidden = false;
  drawWave(r);                    
  
}

function convert() {
  const inp = readInputs();
  const problems = validate(inp);
  showWarnings(problems);

  if (problems.length > 0) {      
    $("out").hidden = true;
    lastResult = null;
    return;
  }

  lastResult = compute(inp.f, inp.a, inp.n, inp.b);
  showResult(lastResult, inp);
}

function showTests() {
  let html = "<thead><tr><th>Test</th><th>Frequency</th><th>Amplitude</th><th>Samples</th><th>Bits</th>" +
             "<th>Period</th><th>Wavelength</th><th>Total bits</th><th>Binary result</th></tr></thead><tbody>";
  TESTS.forEach(t => {
    const r = compute(t.f, t.a, t.n, t.b);
    html += "<tr><td>" + t.name + "</td><td>" + t.f + " Hz</td><td>" + t.a + "</td><td>" + t.n +
            "</td><td>" + t.b + "</td><td>" + r.periodMs.toFixed(2) + " ms</td><td>" +
            formatWavelength(r.wavelength) + "</td><td>" + r.totalBits +
            "</td><td><code>" + r.binary + "</code></td></tr>";
  });
  html += "</tbody>";
  $("tests").innerHTML = html;
}


function playTone() {
  const f = readNumber("freq");
  if (!isFinite(f) || f <= 0) {
    showWarnings(["Frequency must be a number greater than 0."]);
    return;
  }
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) {
    showWarnings(["This browser cannot play sound."]);
    return;
  }
  if (!audioCtx) audioCtx = new AudioCtor();
  if (audioCtx.state === "suspended") audioCtx.resume();

  const a = readNumber("amp");
  const amp = isFinite(a) ? Math.min(Math.max(a, 0), 1) : 1;
  const volume = Math.max(0.15 * amp, 0.001);  
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = Math.min(f, 20000);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.03);
  gain.gain.setValueAtTime(volume, now + 0.95);
  gain.gain.linearRampToValueAtTime(0.0001, now + 1);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 1.05);
}

$("convert").addEventListener("click", convert);
$("play").addEventListener("click", playTone);
document.querySelectorAll("input").forEach(el =>
  el.addEventListener("keydown", e => { if (e.key === "Enter") convert(); })
);
window.addEventListener("resize", () => { if (lastResult) drawWave(lastResult); });

showTests();
