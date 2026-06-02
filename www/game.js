const ALFABE = ['A','B','C','Ç','D','E','F','G','Ğ','H','I','İ','J','K','L','M','N','O','Ö','P','R','S','Ş','T','U','Ü','V','Y','Z'];
const ALFABE_SET = new Set(ALFABE);
const PUAN = {};
ALFABE.forEach((h, i) => PUAN[h] = i + 1);
const MAX_HAK = 6;
const KB_ROWS = [
  ['A','B','C','Ç','D','E'],
  ['F','G','Ğ','H','I','İ'],
  ['J','K','L','M','N','O'],
  ['Ö','P','R','S','Ş','T'],
  ['U','Ü','V','Y','Z']
];

const API_KEY = 'YOUR_API_KEY_HERE';

function trUpper(s) { return s.replace(/i/g,'İ').replace(/ı/g,'I').toUpperCase(); }
function kelimeGecerli(k) { return k.length >= 3 && k.split('').every(h => ALFABE_SET.has(h)); }
function puanHesapla(arr) { return arr.reduce((t, h) => t + (PUAN[h] || 0), 0); }

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let actx = null;
function getACtx() { if (!actx) actx = new AudioCtx(); return actx; }
function playTone(freq, type, dur, vol = 0.3) {
  try {
    const ac = getACtx(), o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.start(); o.stop(ac.currentTime + dur);
  } catch(e) {}
}
function playSuccess() { playTone(523,'sine',0.12,0.25); setTimeout(()=>playTone(659,'sine',0.12,0.25),120); setTimeout(()=>playTone(784,'sine',0.2,0.3),240); }
function playCorrectLetter() { playTone(440,'sine',0.1,0.2); setTimeout(()=>playTone(550,'sine',0.12,0.2),100); }
function playWrong() { playTone(200,'sawtooth',0.18,0.2); setTimeout(()=>playTone(160,'sawtooth',0.18,0.18),160); }
function playHint() { playTone(600,'triangle',0.1,0.18); setTimeout(()=>playTone(500,'triangle',0.12,0.18),130); }
function playGameOver() { playTone(300,'sawtooth',0.15,0.12); setTimeout(()=>playTone(250,'sawtooth',0.15,0.12),150); setTimeout(()=>playTone(200,'sawtooth',0.2,0.15),300); }

let havuz = [], kullanilanlar = new Set();
let kelime = '', dizisi = [], ortaya = new Set();
let kalanHak = MAX_HAK, oyunBitti = false, toplamSkor = 0;
let ipucuKullanildi = false, yukleniyor = false, hintHarf = null;
let sonUzunluk = -1;

function kelimeSeç() {
  if (havuz.length === 0) return null;
  const farkli = havuz.filter(k => k.length !== sonUzunluk);
  const kaynak = farkli.length > 0 ? farkli : havuz;
  const idx = Math.floor(Math.random() * kaynak.length);
  const secilen = kaynak[idx];
  havuz.splice(havuz.indexOf(secilen), 1);
  return secilen;
}

async function havuzYukle() {
  if (yukleniyor) return;
  yukleniyor = true;
  const lm = document.getElementById('loading-msg');
  lm.style.display = 'block';
  lm.textContent = 'Kelimeler yükleniyor...';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Türkçe kelime oyunu için 100 farklı Türkçe kelime üret. Kurallar:
- Sadece şu harfler: A B C Ç D E F G Ğ H I İ J K L M N O Ö P R S Ş T U Ü V Y Z
- 3 ile 10 harf arası, farklı uzunluklarda, her uzunluktan en az 8 kelime olsun
- Günlük Türkçe kelimeler, özel isim yok, yabancı kelime yok
- Sadece büyük harfle virgülle ayrılmış liste, başka hiçbir şey yazma
Örnek: ELMA,KALEM,DENİZ`
        }]
      })
    });
    const d = await r.json();
    havuz = d.content[0].text.trim().split(',')
      .map(k => trUpper(k.trim()))
      .filter(k => kelimeGecerli(k) && !kullanilanlar.has(k));
  } catch(e) {
    havuz = [
      'AT','GÜL','KAR','EV','SU','DAĞ','YOL',
      'KEDI','MASA','ELMA','BALIK','BULUT','GÜNEŞ','ŞARKI',
      'KALEM','ORMAN','BAHÇE','DENİZ','SEBZE','TAVUK','BARDAK',
      'KÖPRÜ','YILDIZ','PENCERE','MUTFAK','ARKADAŞ','CESARET',
      'SANDALYE','SEVİNÇ','BİLGİSAYAR'
    ];
  }
  yukleniyor = false;
  lm.style.display = 'none';
  yeniOyun();
}

async function yeniOyun() {
  if (havuz.length === 0) { kullanilanlar = new Set(); sonUzunluk = -1; await havuzYukle(); return; }
  const secilen = kelimeSeç();
  if (!secilen) { kullanilanlar = new Set(); sonUzunluk = -1; await havuzYukle(); return; }
  kelime = secilen;
  kullanilanlar.add(kelime);
  sonUzunluk = kelime.length;
  dizisi = kelime.split('');
  ortaya = new Set();
  kalanHak = MAX_HAK; oyunBitti = false; ipucuKullanildi = false; hintHarf = null;
  hideMsg();
  document.getElementById('guess-input').value = '';
  document.getElementById('guess-input').disabled = false;
  document.getElementById('guess-btn').disabled = false;
  document.getElementById('newgame-btn').disabled = false;
  const hb = document.getElementById('hint-btn');
  hb.disabled = false; hb.classList.remove('used-hint');
  document.getElementById('word-row').style.display = 'flex';
  renderAll();
}

function renderAll() { renderWord(); renderKB(); renderStats(); renderHaklar(); }

function renderWord() {
  const row = document.getElementById('word-row');
  row.innerHTML = '';
  const n = dizisi.length;
  const containerW = row.clientWidth || 360;
  const maxSize = 58, minSize = 28, gap = 4;
  const available = containerW - 24;
  let size = Math.floor((available - (n - 1) * gap) / n);
  size = Math.max(minSize, Math.min(maxSize, size));
  const fontSize = Math.round(size * 0.38);
  const ptsSize = Math.max(7, Math.round(size * 0.16));
  row.style.gap = gap + 'px';
  dizisi.forEach(h => {
    const ac = ortaya.has(h);
    const isHint = ac && hintHarf === h;
    const box = document.createElement('div');
    box.className = 'lb' + (ac ? (isHint ? ' hint-rev' : ' revealed') : '');
    box.style.width = size + 'px';
    box.style.height = Math.round(size * 1.1) + 'px';
    box.style.fontSize = fontSize + 'px';
    const letter = document.createElement('span');
    letter.textContent = ac ? h : '';
    const pts = document.createElement('span');
    pts.className = 'lb-score';
    pts.style.fontSize = ptsSize + 'px';
    pts.textContent = ac ? (PUAN[h] || '') : '';
    box.appendChild(letter); box.appendChild(pts);
    row.appendChild(box);
  });
}

function renderKB() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  KB_ROWS.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'kb-row';
    row.forEach(h => {
      const btn = document.createElement('button');
      btn.className = 'kb-btn';
      const used = ortaya.has(h);
      if (used && dizisi.includes(h)) btn.classList.add('correct');
      else if (used) btn.classList.add('wrong');
      btn.disabled = used || oyunBitti;
      btn.innerHTML = `<span>${h}</span><span class="kb-pts">${PUAN[h]}</span>`;
      btn.onclick = () => harfSec(h);
      rowDiv.appendChild(btn);
    });
    kb.appendChild(rowDiv);
  });
}

function renderStats() {
  const kp = puanHesapla(dizisi.filter(h => !ortaya.has(h)));
  document.getElementById('s-puan').textContent = kp;
  document.getElementById('s-harf').textContent = dizisi.length;
  document.getElementById('s-skor').textContent = toplamSkor;
}

function renderHaklar() {
  const row = document.getElementById('haklar');
  row.innerHTML = '';
  for (let i = 0; i < MAX_HAK; i++) {
    const d = document.createElement('div');
    d.className = 'hak' + (i >= kalanHak ? ' used' : '');
    row.appendChild(d);
  }
}

function skorEkle(n) {
  if (n <= 0) return;
  toplamSkor += n;
  const el = document.getElementById('s-skor');
  el.textContent = toplamSkor;
  el.classList.remove('skor-flash'); void el.offsetWidth; el.classList.add('skor-flash');
}

function showMsg(t, c) {
  const el = document.getElementById('msg');
  el.textContent = t; el.className = 'msg-stone' + (c ? ' ' + c : '');
  el.style.display = 'flex';
}
function hideMsg() {
  const el = document.getElementById('msg');
  el.style.display = 'none'; el.textContent = ''; el.className = 'msg-stone';
}

function harfSec(h) {
  if (oyunBitti || ortaya.has(h)) return;
  ortaya.add(h);
  const count = dizisi.filter(x => x === h).length;
  if (count > 0) {
    playCorrectLetter();
    showMsg(count > 1 ? `"${h}" harfi ${count} kez var!` : `"${h}" kelimede var!`, 'success');
    renderWord();
  } else {
    kalanHak--;
    playWrong();
    showMsg(`"${h}" yok. 1 hak gitti.`, 'danger');
    renderHaklar();
  }
  renderKB(); renderStats();
  kontrolEt();
}

function ipucuKullan() {
  if (oyunBitti || ipucuKullanildi || kalanHak < 2) return;
  const tekler = ALFABE.filter(h => dizisi.filter(x => x === h).length === 1 && !ortaya.has(h));
  if (tekler.length === 0) { showMsg('Uygun harf yok', 'warning'); return; }
  const h = tekler[Math.floor(Math.random() * tekler.length)];
  ipucuKullanildi = true; hintHarf = h; kalanHak -= 2;
  ortaya.add(h); playHint();
  showMsg(`İpucu: "${h}" açıldı! (-2 hak)`, 'warning');
  const hb = document.getElementById('hint-btn');
  hb.disabled = true; hb.classList.add('used-hint');
  renderAll(); kontrolEt();
}

function kontrolEt() {
  if ([...new Set(dizisi)].every(h => ortaya.has(h))) {
    oyunBitti = true;
    const kp = puanHesapla(dizisi.filter(h => !ortaya.has(h)));
    skorEkle(kp); playSuccess();
    showMsg(`Tebrikler! "${kelime}" +${kp} puan!`, 'success');
    bitir();
    setTimeout(() => yeniOyun(), 2000);
    return;
  }
  if (kalanHak <= 0) {
    kalanHak = 0; oyunBitti = true;
    dizisi.forEach(h => ortaya.add(h));
    renderWord(); renderHaklar();
    playGameOver();
    showMsg(`Hakkın bitti! Kelime: "${kelime}"`, 'danger');
    bitir();
  }
}

function bitir() {
  document.getElementById('guess-input').disabled = true;
  document.getElementById('guess-btn').disabled = true;
  document.getElementById('hint-btn').disabled = true;
  renderKB();
}

document.getElementById('guess-btn').onclick = () => {
  if (oyunBitti) return;
  const inp = document.getElementById('guess-input');
  const raw = inp.value.trim(); if (!raw) return;
  const tahmin = trUpper(raw); inp.value = '';
  if (tahmin === kelime) {
    oyunBitti = true;
    const kp = puanHesapla(dizisi.filter(h => !ortaya.has(h)));
    skorEkle(kp); dizisi.forEach(h => ortaya.add(h));
    renderAll(); playSuccess();
    showMsg(`Doğru tahmin! "${kelime}" +${kp} puan!`, 'success');
    bitir();
    setTimeout(() => yeniOyun(), 2000);
  } else {
    kalanHak = Math.max(0, kalanHak - 2);
    playWrong();
    showMsg(`Yanlış tahmin! 2 hak gitti. Kalan: ${kalanHak}`, 'danger');
    renderHaklar(); renderStats();
    if (kalanHak <= 0) {
      oyunBitti = true;
      dizisi.forEach(h => ortaya.add(h));
      renderWord(); renderHaklar();
      playGameOver();
      showMsg(`Hakkın bitti! Kelime: "${kelime}"`, 'danger');
      bitir();
    }
  }
};

document.getElementById('hint-btn').onclick = () => ipucuKullan();
document.getElementById('guess-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('guess-btn').click();
});
document.getElementById('newgame-btn').onclick = () => yeniOyun();

havuzYukle();
