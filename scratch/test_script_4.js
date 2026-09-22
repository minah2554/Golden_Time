
    // ============================================================
    // ★ 교사용 인트로 영상 URL (여기서 교체)
    // YouTube: "https://www.youtube.com/embed/VIDEO_ID?autoplay=1"
    // MP4: "./intro_video.mp4"
    const VIDEO_URL = "./intro.mp4";
    // ============================================================

    const G = {
      stamps: [false, false, false, false],
      sec: 35 * 60, running: false, paused: false, soundOn: true,
      timerInt: null, hbInt: null, ecgAnim: null,
      player: { cls: '', grp: '', leader: '', members: [] },
      hintCount: 0,
      openedHints: {},
      startTime: null,
      clearDuration: null,
      clearTimeStr: null,
    };

    // [answers.js] 연동 단일 고유 정답 검증 시스템 (중복/유사 정답 불가)
    // ============================================================
    // 🔑 [answers.js] 연동 고유 정답 검증 (중복/유사 정답 불가)
    // ============================================================
    const ANS = {
      1: v => {
        const target = (window.GAME_ANSWERS && window.GAME_ANSWERS.chart1) ? window.GAME_ANSWERS.chart1 : "펩신";
        return v.trim().replace(/\s/g, '') === target.trim().replace(/\s/g, '');
      },
      2: v => {
        const target = (window.GAME_ANSWERS && window.GAME_ANSWERS.chart2) ? window.GAME_ANSWERS.chart2 : "4129";
        return v.trim().replace(/\s/g, '') === target.trim().replace(/\s/g, '');
      },
      3: v => {
        const target = (window.GAME_ANSWERS && window.GAME_ANSWERS.chart3) ? window.GAME_ANSWERS.chart3 : "8522";
        return v.trim().replace(/\s/g, '') === target.trim().replace(/\s/g, '');
      },
      4: v => {
        const target = (window.GAME_ANSWERS && window.GAME_ANSWERS.chart4) ? window.GAME_ANSWERS.chart4 : "3709";
        return v.trim().replace(/\s/g, '') === target.trim().replace(/\s/g, '');
      },
      f: v => {
        const target = (window.GAME_ANSWERS && window.GAME_ANSWERS.final) ? window.GAME_ANSWERS.final : "3817";
        return v.trim().replace(/\s/g, '') === target.trim().replace(/\s/g, '');
      }
    };
    const SNAMES = ['소화기', '순환기', '호흡기', '신장내과'];
    const SIDS = ['stamp-digest', 'stamp-cardio', 'stamp-resp', 'stamp-renal'];
    const SICONS = ['🧪', '🫀', '🫁', '🫘'];

    let bc = null;
    try { bc = new BroadcastChannel('escape_room_bus'); bc.onmessage = e => onBC(e.data); } catch (e) { }
    function sendBC(type, data = {}) { if (!bc) return; try { bc.postMessage({ type, data, grp: G.player.grp, ts: Date.now() }); } catch (e) { } }
    const grpStates = {};
    function onBC(msg) {
      if (msg.type === 'BROADCAST_NOTICE') { showBCModal(msg.data.msg); snd('alarm'); }
      if (msg.type === 'TIMER_CTRL') {
        if (msg.data.a === 'pause') togglePause();
        if (msg.data.a === 'add5') { G.sec = Math.min(G.sec + 300, 99 * 60); updTimer(); }
        if (msg.data.a === 'reset') { G.sec = 35 * 60; updTimer(); }
      }
      if (msg.type === 'FORCE_APPROVE' && (msg.data.grp === G.player.grp || msg.data.grp === 'all')) approveStamp(msg.data.n);
      if (msg.type === 'REQ_STATE') {
        sendBC('STUDENT_STATE', {
          cls: G.player.cls,
          grp: G.player.grp,
          leader: G.player.leader,
          members: G.player.members,
          stamps: G.stamps,
          hintCount: G.hintCount || 0,
          clearTimeStr: G.clearTimeStr || null,
          sec: G.sec,
          updatedAt: Date.now()
        });
      }
      if (msg.type === 'STUDENT_STATE' && msg.data && msg.data.grp) {
        grpStates[msg.data.grp] = Object.assign(grpStates[msg.data.grp] || {}, msg.data, { updatedAt: Date.now() });
        renderTGroups();
      }
      if (msg.type === 'RESET_GROUP' && msg.data && msg.data.grp === G.player.grp) {
        resetGame();
      }
      if (msg.type === 'RESET_ALL') {
        resetGame();
      }
    }

    let actx = null;
    function getActx() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; }
    function snd(t) { if (!G.soundOn) return; try { const ctx = getActx(), now = ctx.currentTime; if (t === 'hb') playHB(ctx, now); else if (t === 'ok') playOK(ctx, now); else if (t === 'err') playErr(ctx, now); else if (t === 'alarm') playAlarm(ctx, now); else if (t === 'fanfare') playFanfare(ctx, now); else if (t === 'stamp') playStamp(ctx, now); else if (t === 'beep') playBeep(ctx, now); } catch (e) { } }
    function mkOG(ctx, type, freq, vol) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = vol; o.connect(g); g.connect(ctx.destination); return { o, g }; }
    function playHB(ctx, now) { const { o, g } = mkOG(ctx, 'sine', 80, .28); g.gain.setValueAtTime(.28, now); g.gain.exponentialRampToValueAtTime(.001, now + .12); o.start(now); o.stop(now + .15); const { o: o2, g: g2 } = mkOG(ctx, 'sine', 100, .14); g2.gain.setValueAtTime(.14, now + .08); g2.gain.exponentialRampToValueAtTime(.001, now + .2); o2.start(now + .08); o2.stop(now + .22); }
    function playOK(ctx, now) { [523, 659, 784, 1047].forEach((f, i) => { const { o, g } = mkOG(ctx, 'sine', f, .18), t = now + i * .1; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.18, t + .05); g.gain.exponentialRampToValueAtTime(.001, t + .35); o.start(t); o.stop(t + .4); }); }
    function playErr(ctx, now) { const { o, g } = mkOG(ctx, 'sawtooth', 150, .28); g.gain.setValueAtTime(.28, now); g.gain.exponentialRampToValueAtTime(.001, now + .4); o.start(now); o.stop(now + .4); }
    function playAlarm(ctx, now) { const { o, g } = mkOG(ctx, 'square', 880, .18); o.frequency.setValueAtTime(880, now); o.frequency.linearRampToValueAtTime(440, now + .5); o.frequency.linearRampToValueAtTime(880, now + 1); g.gain.setValueAtTime(.18, now); g.gain.setValueAtTime(0, now + 1.2); o.start(now); o.stop(now + 1.2); }
    function playFanfare(ctx, now) { [523, 659, 784, 1047, 784, 1047, 1175, 1047].forEach((f, i) => { const { o, g } = mkOG(ctx, 'triangle', f, .22), t = now + i * .15; g.gain.setValueAtTime(.22, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); o.start(t); o.stop(t + .35); }); }
    function playStamp(ctx, now) { const { o, g } = mkOG(ctx, 'square', 200, .35); g.gain.setValueAtTime(.35, now); g.gain.exponentialRampToValueAtTime(.001, now + .2); o.start(now); o.stop(now + .25); }
    function playBeep(ctx, now) { const { o, g } = mkOG(ctx, 'sine', 440, .1); g.gain.setValueAtTime(.1, now); g.gain.exponentialRampToValueAtTime(.001, now + .05); o.start(now); o.stop(now + .08); }

    let ecgCtx2, ecgX = 0;
    const ECG = [0, 0, 0, -.1, -.2, -.1, 0, 0, 0, 0, 0, .2, .8, -.4, 0, .1, .15, .1, .05, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    function initECG() { const c = document.getElementById('ecg-canvas'); if (!c) return; c.width = c.offsetWidth || 240; c.height = 48; ecgCtx2 = c.getContext('2d'); ecgX = 0; drawECG(); }
    function drawECG() {
      if (!ecgCtx2) { G.ecgAnim = requestAnimationFrame(drawECG); return; }
      const c = document.getElementById('ecg-canvas');
      if (!c || !c.offsetParent) { G.ecgAnim = requestAnimationFrame(drawECG); return; }
      const w = c.width, h = c.height, cnt = G.stamps.filter(Boolean).length, bpm = [142, 120, 100, 85, 72][cnt];
      ecgCtx2.fillStyle = 'rgba(11,15,25,.3)'; ecgCtx2.fillRect(0, 0, w, h);
      const mid = h / 2, idx = Math.floor(ecgX / 5) % ECG.length, val = ECG[idx] * (h * .4);
      const pi = Math.max(0, Math.floor((ecgX - 2) / 5) % ECG.length), pv = ECG[pi] * (h * .4);
      ecgCtx2.beginPath(); ecgCtx2.strokeStyle = '#22c55e'; ecgCtx2.lineWidth = 2; ecgCtx2.shadowColor = '#22c55e'; ecgCtx2.shadowBlur = 6;
      ecgCtx2.moveTo((ecgX - 2 + w * 10) % w, mid - pv); ecgCtx2.lineTo(ecgX % w, mid - val); ecgCtx2.stroke(); ecgCtx2.shadowBlur = 0;
      ecgX += bpm / 60 * 2; if (ecgX > w * 10) ecgX = 0;
      G.ecgAnim = requestAnimationFrame(drawECG);
    }

    function getHBI() { return [420, 500, 600, 705, 833][G.stamps.filter(Boolean).length]; }
    function startTimer() { if (G.running) return; G.running = true; G.timerInt = setInterval(tick, 1000); G.hbInt = setInterval(() => { if (!G.paused) snd('hb'); }, getHBI()); }
    function tick() { if (G.paused) return; G.sec--; if (G.sec <= 0) { G.sec = 0; clearInterval(G.timerInt); G.running = false; updTimer(); showTO(); return; } updTimer(); }
    function updTimer() { const m = String(Math.floor(G.sec / 60)).padStart(2, '0'), s = String(G.sec % 60).padStart(2, '0'); const d = document.getElementById('timer-display'); if (d) { d.textContent = m + ':' + s; d.style.color = G.sec <= 300 ? '#ef4444' : G.sec <= 600 ? '#f59e0b' : '#ef4444'; } }
    function togglePause() { G.paused = !G.paused; const b = document.getElementById('btn-pause'); if (b) b.textContent = G.paused ? '▶ 재개' : '⏸ 정지'; }
    function toggleSound() { G.soundOn = !G.soundOn; const b = document.getElementById('btn-sound'); if (b) b.textContent = G.soundOn ? '🔊' : '🔇'; }
    function showTO() { const m = document.createElement('div'); m.className = 'modal-backdrop'; m.id = 'modal-timeout'; m.innerHTML = '<div class="modal-content max-w-sm"><div class="p-6 text-center"><div class="text-6xl mb-4">⏰</div><div class="orb text-red-400 font-black text-2xl mb-2">TIME OVER</div><p class="text-slate-300 text-sm mb-4">제한 시간이 종료되었습니다.<br>선생님의 안내에 따라 주세요.</p><button onclick="resetGame()" class="btn-neon btn-cyan w-full py-3 text-sm">🔄 다시 도전</button></div></div>'; document.body.appendChild(m); }

    function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }

    document.querySelectorAll('.grp-lbl').forEach(lb => {
      lb.addEventListener('click', function () {
        document.querySelectorAll('.grp-lbl').forEach(l => { l.classList.remove('border-cyan-500', 'bg-cyan-900/20', 'text-cyan-400'); l.classList.add('border-slate-700'); });
        this.classList.add('border-cyan-500', 'bg-cyan-900/20', 'text-cyan-400'); this.classList.remove('border-slate-700');
        this.querySelector('input').checked = true;
      });
    });

    function handleLogin() {
      const cls = document.getElementById('login-class').value;
      const grpEl = document.querySelector('input[name="group"]:checked');
      const leader = document.getElementById('login-leader').value.trim();
      if (!cls) { toast('학급을 선택하세요!', 'err'); return; }
      if (!grpEl) { toast('모둠을 선택하세요!', 'err'); return; }
      if (!leader) { toast('팀장 이름을 입력하세요!', 'err'); return; }
      G.player = { cls: '2학년 ' + cls + '반', grp: grpEl.value, leader, members: document.getElementById('login-members').value.split(',').map(m => m.trim()).filter(Boolean) };
      saveLS(); snd('beep');
      // 인트로 동영상 준비 및 자동 재생 시도
      const videoEl = document.getElementById('intro-video-player');
      if (videoEl) {
        try {
          videoEl.currentTime = 0;
          videoEl.play().catch(() => { });
        } catch (e) { }
      } else if (VIDEO_URL) {
        const va = document.getElementById('video-area');
        if (va) {
          if (VIDEO_URL.includes('youtube')) {
            va.innerHTML = '<iframe style="position:absolute;inset:0;width:100%;height:100%" src="' + VIDEO_URL + '" allow="autoplay;fullscreen" allowfullscreen></iframe>';
          } else {
            va.innerHTML = '<video id="intro-video-player" controls autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000" src="' + VIDEO_URL + '"></video>';
          }
        }
      }
      showScreen('screen-intro');
    }

    function startGame() {
      const ht = document.getElementById('header-team'); if (ht) ht.textContent = G.player.grp + '모둠 · ' + G.player.leader;
      showScreen('screen-dashboard'); snd('alarm');
      setTimeout(() => { initECG(); startTimer(); }, 300); updVitals();
    }

    function openMission(n) { document.getElementById('modal-' + n).classList.remove('hidden'); snd('beep'); if (G.stamps[n - 1]) { const inp = document.getElementById('ci' + n); if (inp) inp.disabled = true; setMsg(n, '✅ 이미 치료 완료된 장기입니다!', 'ok'); } }
    function openFinalMission() { document.getElementById('modal-final').classList.remove('hidden'); snd('alarm'); }
    function closeModal(id) { if (id === 'modal-teacher' && tDashInterval) { clearInterval(tDashInterval); tDashInterval = null; } document.getElementById(id).classList.add('hidden'); }
    function closeSuccess() { closeModal('modal-success'); checkAllStamps(); }

    function tHint(id) { const el = document.getElementById(id), ic = document.getElementById(id + '-ic'); if (!el) return; el.classList.toggle('open'); if (ic) ic.textContent = el.classList.contains('open') ? '▲' : '▼'; }

    function setMsg(n, txt, type) { const el = document.getElementById('cm' + n); if (!el) return; el.classList.remove('hidden'); el.className = 'text-center text-sm mb-3 font-bold ' + (type === 'ok' ? 'text-green-400' : 'text-red-400'); el.innerHTML = txt; }
    function submitCode(n) {
      if (G.stamps[n - 1]) return;
      const inp = document.getElementById('ci' + n); if (!inp) return; const val = inp.value;
      if (!val) { shakeEl(inp); return; }
      if (ANS[n](val)) { inp.disabled = true; setMsg(n, '✅ 정답! 치료 성공!', 'ok'); closeModal('modal-' + n); setTimeout(() => approveStamp(n), 300); }
      else { shakeEl(inp); setMsg(n, '❌ 오답입니다. 다시 확인하세요!', 'err'); snd('err'); }
    }
    function submitFinal() {
      const inp = document.getElementById('ci-final'), msg = document.getElementById('cm-final'); if (!inp) return; const val = inp.value;
      if (!val) { shakeEl(inp); return; }
      if (ANS.f(val)) { inp.disabled = true; closeModal('modal-final'); snd('fanfare'); startFW(); setTimeout(showCert, 2000); }
      else { shakeEl(inp); msg.classList.remove('hidden'); msg.className = 'text-center text-sm mb-3 text-red-400 font-bold'; msg.innerHTML = '❌ 오답! 포스터를 다시 확인하세요.'; snd('err'); }
    }
    function shakeEl(el) { el.classList.add('err-shake'); setTimeout(() => el.classList.remove('err-shake'), 600); }

    function approveStamp(n) {
      const idx = n - 1; if (G.stamps[idx]) return; G.stamps[idx] = true;
      const slot = document.getElementById(SIDS[idx]); if (slot) slot.classList.add('active');
      const card = document.getElementById('mc' + n); if (card) card.classList.add('card-complete');
      const badge = document.getElementById('badge-' + n); if (badge) { badge.className = 'status-badge badge-success'; badge.innerHTML = '✓ 치료완료'; }
      const cnt = G.stamps.filter(Boolean).length;
      const sc = document.getElementById('stamp-count'); if (sc) sc.textContent = cnt;
      snd('stamp'); setTimeout(() => snd('ok'), 200); updVitals();
      document.getElementById('s-icon').innerHTML = SICONS[idx];
      document.getElementById('s-organ').textContent = SNAMES[idx] + ' 치료 완료!';
      document.getElementById('modal-success').classList.remove('hidden');
      saveLS(); sendBC('STAMP', { n, stamps: G.stamps });
      if (G.hbInt) { clearInterval(G.hbInt); G.hbInt = setInterval(() => { if (!G.paused) snd('hb'); }, getHBI()); }
    }
    function checkAllStamps() { if (G.stamps.every(Boolean)) { document.getElementById('final-locked').classList.add('hidden'); document.getElementById('final-unlocked').classList.remove('hidden'); snd('alarm'); setTimeout(() => snd('alarm'), 600); } }

    function updVitals() {
      const cnt = G.stamps.filter(Boolean).length;
      const BPM = [142, 120, 100, 85, 72][cnt], SPO2 = [78, 85, 91, 96, 99][cnt], GFR = [32, 45, 60, 78, 95][cnt];
      const ok = cnt >= 4, warn = cnt >= 2;
      const bc2 = ok ? '#22c55e' : warn ? '#f59e0b' : '#ef4444', sc = ok ? '#22c55e' : '#f59e0b', gc = ok ? '#22c55e' : '#a855f7';
      const sV = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      const sC = (id, c) => { const e = document.getElementById(id); if (e) e.style.color = c; };
      const sW = (id, w, c) => { const e = document.getElementById(id); if (e) { e.style.width = w + '%'; e.style.backgroundColor = c; } };
      sV('vital-bpm', BPM); sV('vital-spo2', SPO2 + '%'); sV('vital-gfr', GFR);
      sC('vital-bpm', bc2); sC('vital-spo2', sc); sC('vital-gfr', gc);
      sW('vital-bpm-bar', BPM / 142 * 100, bc2); sW('vital-spo2-bar', SPO2, sc); sW('vital-gfr-bar', GFR, gc);
    }

    function showCert() {
      const tot = 35 * 60 - G.sec, mm = String(Math.floor(tot / 60)).padStart(2, '0'), ss = String(tot % 60).padStart(2, '0');
      document.getElementById('cert-leader').textContent = G.player.leader || '─';
      document.getElementById('cert-team').textContent = G.player.members.join(', ') || '─';
      document.getElementById('cert-class').textContent = G.player.cls + ' ' + G.player.grp + '모둠';
      document.getElementById('cert-time').textContent = mm + '분 ' + ss + '초';
      document.getElementById('modal-complete').classList.remove('hidden');
      sendBC('COMPLETE', { time: mm + ':' + ss });
    }

    function startFW() {
      const c = document.getElementById('fw-canvas'); c.style.display = 'block'; c.width = innerWidth; c.height = innerHeight;
      const ctx = c.getContext('2d'), pts = [];
      const cols = ['#06b6d4', '#f59e0b', '#22c55e', '#ef4444', '#a855f7', '#ec4899', '#fff'];
      for (let i = 0; i < 8; i++) setTimeout(() => {
        const x = Math.random() * c.width, y = Math.random() * c.height * .6;
        for (let j = 0; j < 60; j++) { const a = Math.PI * 2 / 60 * j, sp = Math.random() * 8 + 2; pts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, col: cols[~~(Math.random() * cols.length)], life: 1, dec: Math.random() * .015 + .008, sz: Math.random() * 4 + 1 }); }
      }, i * 300);
      function anim() { ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(0, 0, c.width, c.height); for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; p.x += p.vx; p.y += p.vy; p.vy += .15; p.life -= p.dec; if (p.life <= 0) { pts.splice(i, 1); continue; } ctx.globalAlpha = p.life; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; if (pts.length > 0) requestAnimationFrame(anim); else { ctx.clearRect(0, 0, c.width, c.height); c.style.display = 'none'; } }
      anim();
    }

    function openTeacherLogin() { document.getElementById('modal-tlogin').classList.remove('hidden'); document.getElementById('tpw').value = ''; document.getElementById('tpw-err').classList.add('hidden'); setTimeout(() => document.getElementById('tpw').focus(), 100); }
    
// ============================================================
// 🔒 [교사용 보안 인증] 개발자 도구 검색 시 평문이 노출되지 않도록 해시 및 바이트 시그니처 검증
// ============================================================
let tDashInterval = null;

async function checkTeacher() {
  const el = document.getElementById('tpw');
  const rawVal = (el ? el.value : '').trim();
  const cleanVal = rawVal.toLowerCase();
  
  // 1) SHA-256 해시 검증
  let h = '';
  try {
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cleanVal));
      h = Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    }
  } catch(e) {}

  // 2) 아스키 바이트 서명 검증 [109, 105, 110, 97, 104] (평문 노출 없이 모든 환경 호환)
  const _s = [109, 105, 110, 97, 104];
  const isByteMatch = cleanVal.length === _s.length && _s.every((c, i) => cleanVal.charCodeAt(i) === c);
  const isHashMatch = (h === "ad5f52f58ed6ec6e7a641f2416f347674ac5933470079f2a18bc6269b1e80796");

  if (isHashMatch || isByteMatch) {
    closeModal('modal-tlogin');
    if (el) el.value = '';
    const errEl = document.getElementById('tpw-err');
    if (errEl) errEl.classList.add('hidden');
    openTDash();
  } else {
    const errEl = document.getElementById('tpw-err');
    if (errEl) errEl.classList.remove('hidden');
    snd('err');
  }
}

function openTDash() {
  document.getElementById('modal-teacher').classList.remove('hidden');
  
  // 1. 현재 학급 표시 업데이트
  updateClassBadge();

  // 2. 로컬 스토리지에 보관된 모둠 데이터 로드
  for (let g = 1; g <= 6; g++) {
    try {
      const d = localStorage.getItem('esc_' + g);
      if (d) grpStates[g] = Object.assign(grpStates[g] || {}, JSON.parse(d));
    } catch(e) {}
  }
  if (G.player.grp) {
    grpStates[G.player.grp] = {
      cls: G.player.cls,
      grp: G.player.grp,
      leader: G.player.leader,
      members: G.player.members,
      stamps: G.stamps,
      hintCount: G.hintCount || 0,
      clearTimeStr: G.clearTimeStr || null,
      sec: G.sec,
      updatedAt: Date.now()
    };
  }

  // 3. 브로드캐스트 상태 요청
  sendBC('REQ_STATE');
  renderTGroups();

  // 4. 실시간 진행 시간 자동 갱신 (1초마다 카드 경과 시간 리프레시)
  if (tDashInterval) clearInterval(tDashInterval);
  tDashInterval = setInterval(() => {
    if (G.player.grp && grpStates[G.player.grp] && !grpStates[G.player.grp].clearTimeStr) {
      grpStates[G.player.grp].sec = G.sec;
      grpStates[G.player.grp].hintCount = G.hintCount || 0;
    }
    renderTGroups();
  }, 1000);
}

function updateClassBadge() {
  const curCls = G.player.cls || (function() {
    for (let g = 1; g <= 6; g++) {
      try {
        const d = localStorage.getItem('esc_' + g);
        if (d) { const p = JSON.parse(d); if (p.cls) return p.cls; }
      } catch(e) {}
    }
    return '';
  })();
  const badge = document.getElementById('t-class-badge');
  if (badge) {
    badge.textContent = curCls ? ('🏥 2학년 ' + curCls + '반 실시간 관제') : '🏥 2학년 전체 관제';
  }
}

function renderTGroups() {
  const gr = document.getElementById('t-group-grid');
  if (!gr) return;
  updateClassBadge();

  let htmlStr = '';
  for (let g = 1; g <= 6; g++) {
    const s = grpStates[g];
    const cnt = s && s.stamps ? s.stamps.filter(Boolean).length : 0;
    const isCleared = !!(s && (s.clearTimeStr || cnt === 4));
    const isConnected = !!(s && (s.leader || s.updatedAt));

    // 장기별 스탬프 아이콘
    const si = ['🧪','🫀','🫁','🫘'].map((ic, i) =>
      '<span style="opacity:' + (s && s.stamps && s.stamps[i] ? 1 : 0.2) + ';font-size:1.2rem;" title="차트 0' + (i+1) + '">' + ic + '</span>'
    ).join(' ');

    // 💡 힌트 사용 횟수
    const hintBadge = '<div class="mt-2 text-xs flex items-center justify-between bg-slate-900/60 px-2 py-1 rounded border border-slate-800">' +
      '<span class="text-amber-400 font-bold flex items-center gap-1">💡 힌트 사용:</span>' +
      '<span class="font-bold text-white bg-slate-800 px-2 py-0.5 rounded">' + (s && s.hintCount ? s.hintCount : 0) + '회</span>' +
      '</div>';

    // ⏱ 각 팀별 진행 시간 표시 (핵심 요구사항!)
    let timeBadge = '';
    let statusBadge = '';

    if (!isConnected) {
      statusBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-400">⚪ 미접속</span>';
      timeBadge = '<div class="mt-2 text-xs text-slate-500 font-bold orb flex items-center justify-between bg-slate-900/40 p-2 rounded border border-slate-800/40">' +
        '<span>⏱ 진행 시간:</span><span>대기 중 (미접속)</span></div>';
    } else if (isCleared) {
      statusBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-green-950 text-green-300 border border-green-700">🏆 완치 완료</span>';
      timeBadge = '<div class="mt-2 text-xs text-green-300 font-bold orb flex flex-col gap-1 bg-green-950/40 p-2 rounded border border-green-800/50">' +
        '<div class="flex justify-between items-center"><span class="text-green-400">⏱ 최종 소요 시간:</span><span class="text-sm font-black text-white">' + (s.clearTimeStr || '완료') + '</span></div>' +
        '<div class="text-[10px] text-green-400/80 text-right">환자 생체 반응 완벽 회복</div></div>';
    } else {
      statusBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700 animate-pulse">🟢 작전 진행 중</span>';
      const curSec = s.sec !== undefined ? s.sec : (g === G.player.grp ? G.sec : 35 * 60);
      const elapsed = Math.max(0, (35 * 60) - curSec);
      const em = Math.floor(elapsed / 60);
      const es = elapsed % 60;
      const rm = Math.floor(curSec / 60);
      const rs = curSec % 60;

      timeBadge = '<div class="mt-2 text-xs font-bold orb flex flex-col gap-1 bg-cyan-950/40 p-2 rounded border border-cyan-800/50">' +
        '<div class="flex justify-between items-center text-cyan-300"><span>⏱ 진행 시간:</span><span class="text-sm font-black text-white">' + em + '분 ' + (es < 10 ? '0' : '') + es + '초 경과</span></div>' +
        '<div class="flex justify-between items-center text-[11px] text-amber-400"><span>⏳ 남은 시간:</span><span>' + rm + '분 ' + (rs < 10 ? '0' : '') + rs + '초</span></div></div>';
    }

    // 모둠별 개별 리셋 버튼
    const resetBtn = isConnected
      ? '<button onclick="resetGroupData(' + g + ')" class="w-full mt-2.5 py-1.5 px-2 rounded bg-red-950/60 border border-red-800 text-red-300 text-xs font-bold hover:bg-red-900 transition-all flex items-center justify-center gap-1 shadow-sm">🔄 이 팀 데이터 리셋</button>'
      : '';

    const leaderName = s && s.leader ? s.leader : (isConnected ? '모둠원' : '미접속');
    const memberStr = s && s.members ? '<div class="text-[11px] text-slate-400 truncate mb-1">팀원: ' + s.members + '</div>' : '';

    htmlStr += `
      <div class="teacher-card p-3.5 rounded-xl bg-[#0f1628]/90 border border-cyan-900/40 shadow-lg flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-center mb-1.5">
            <span class="orb text-cyan-400 text-sm font-black">${g}모둠</span>
            ${statusBadge}
          </div>
          <div class="text-white text-sm font-bold mb-0.5 truncate flex items-center gap-1.5">
            <span>${s && s.cls ? s.cls + '반 ' : ''}</span>
            <span class="text-cyan-200">${leaderName}</span>
          </div>
          ${memberStr}
          <div class="flex items-center justify-between mt-2 mb-1 bg-slate-950/50 p-1.5 rounded">
            <span class="text-[11px] text-slate-400">치료 진척도:</span>
            <span class="text-amber-400 text-xs font-black">${cnt} / 4 완료</span>
          </div>
          <div class="flex justify-center gap-2 my-2 py-1 bg-slate-900/40 rounded border border-slate-800/40">${si}</div>
          ${hintBadge}
          ${timeBadge}
        </div>
        ${resetBtn}
      </div>
    `;
  }
  gr.innerHTML = htmlStr;
}

// 교사 관리자: 특정 모둠 데이터 리셋
function resetGroupData(g) {
  if (!confirm(g + '모둠의 저장된 모든 데이터(치료 스탬프, 힌트 수, 진행 시간)를 초기화하시겠습니까?')) return;
  try { localStorage.removeItem('esc_' + g); } catch(e) {}
  delete grpStates[g];
  if (G.player.grp === g) {
    G.stamps = [false, false, false, false];
    G.hintCount = 0;
    G.sec = 35 * 60;
    G.clearTimeStr = null;
    updTimer();
    renderStamps();
    saveLS();
  }
  sendBC('RESET_GROUP', { grp: g });
  renderTGroups();
  toast(g + '모둠 데이터가 성공적으로 초기화되었습니다.', 'ok');
}

// 교사 관리자: 전체 모둠 일괄 리셋 (수업 초기화)
function resetAllGroups() {
  if (!confirm('⚠️ 전체 1~6모둠의 진행 상황과 힌트 기록을 모두 초기화하시겠습니까?\n(새로운 수업이나 반 변경 시 사용합니다)')) return;
  for (let g = 1; g <= 6; g++) {
    try { localStorage.removeItem('esc_' + g); } catch(e) {}
    delete grpStates[g];
  }
  G.stamps = [false, false, false, false];
  G.hintCount = 0;
  G.sec = 35 * 60;
  G.clearTimeStr = null;
  updTimer();
  renderStamps();
  saveLS();
  sendBC('RESET_ALL');
  renderTGroups();
  toast('모든 모둠의 데이터가 전체 초기화되었습니다.', 'ok');
}

function tCtrl(a) { if (a === 'pause') togglePause(); if (a === 'add5') { G.sec = Math.min(G.sec + 300, 99 * 60); updTimer(); } if (a === 'reset') { G.sec = 35 * 60; updTimer(); } sendBC('TIMER_CTRL', { a }); }
    function forceApprove(n) { approveStamp(n); sendBC('FORCE_APPROVE', { n, grp: 'all' }); }
    function sendBroadcast() { const msg = document.getElementById('bc-msg').value.trim(); if (!msg) { toast('공지 메시지를 입력하세요!', 'err'); return; } sendBC('BROADCAST_NOTICE', { msg }); showBCModal(msg); snd('alarm'); document.getElementById('bc-msg').value = ''; toast('긴급 공지 전송 완료!', 'ok'); }
    function showBCModal(msg) { document.getElementById('bc-content').textContent = msg; document.getElementById('modal-broadcast').classList.remove('hidden'); }
    function closeBroadcast() { document.getElementById('modal-broadcast').classList.add('hidden'); }

    function resetGame() {
      G.stamps = [false, false, false, false]; G.sec = 35 * 60; G.running = false; G.paused = false;
      if (G.timerInt) clearInterval(G.timerInt); if (G.hbInt) clearInterval(G.hbInt); if (G.ecgAnim) cancelAnimationFrame(G.ecgAnim);
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
      const to = document.getElementById('modal-timeout'); if (to) to.remove();
      [1, 2, 3, 4].forEach(n => {
        const inp = document.getElementById('ci' + n); if (inp) { inp.value = ''; inp.disabled = false; inp.classList.remove('err-shake'); }
        const msg = document.getElementById('cm' + n); if (msg) msg.classList.add('hidden');
        const b = document.getElementById('badge-' + n); if (b) { b.className = 'status-badge badge-danger'; b.innerHTML = '● 위독'; }
        const c = document.getElementById('mc' + n); if (c) c.classList.remove('card-complete');
      });
      SIDS.forEach(id => { const e = document.getElementById(id); if (e) e.classList.remove('active'); });
      const sc = document.getElementById('stamp-count'); if (sc) sc.textContent = '0';
      document.getElementById('final-locked').classList.remove('hidden');
      document.getElementById('final-unlocked').classList.add('hidden');
      const cf = document.getElementById('ci-final'); if (cf) { cf.value = ''; cf.disabled = false; }
      const cmf = document.getElementById('cm-final'); if (cmf) cmf.classList.add('hidden');
      updTimer(); updVitals(); showScreen('screen-login'); ecgCtx2 = null; ecgX = 0;
    }

    function saveLS() {
      try {
        localStorage.setItem('esc_' + G.player.grp, JSON.stringify({
          cls: G.player.cls,
          grp: G.player.grp,
          leader: G.player.leader,
          members: G.player.members,
          stamps: G.stamps,
          hintCount: G.hintCount || 0,
          clearTimeStr: G.clearTimeStr || null,
          sec: G.sec
        }));
      } catch (e) { }
    }

    let toastT;
    function toast(msg, type = 'info') { const el = document.getElementById('toast'); if (!el) return; el.textContent = msg; el.style.background = type === 'err' ? 'rgba(239,68,68,.9)' : type === 'ok' ? 'rgba(34,197,94,.9)' : 'rgba(6,182,212,.9)'; el.style.opacity = '1'; if (toastT) clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = '0', 3000); }

    document.addEventListener('click', () => { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); }, { passive: true });

    // ============================================================
    // 💡 [hints.js] 연동 힌트 동적 렌더링 시스템
    // ============================================================

    const DEFAULT_HINTS = {
  chart1: {
    step1: {
      title: "💡 문제풀이 힌트",
      lines: [
        "• <span class=\"text-cyan-400 font-bold\">갈림길 이동 순서:</span>",
        "• (1,3) 식도 ➔ (3,7) 위 ➔ (6,4) 샘창자 ➔ (9,2) 이자 ➔ (9,6) 작은창자 ➔ (8,9) 큰창자 순으로 이동합니다."
      ]
    },
    step2: {
      title: "🔑 암호 힌트",
      lines: [
        "• 바른 경로를 따라 통과하며 수집한 알파벳은 순서대로 <span class=\"text-amber-400 font-bold orb\">VPQTLS</span>입니다.",
        "• 영문 키보드 자판을 한글로 치환(<span class=\"text-cyan-400 font-bold\">V➔ㅍ, P➔ㅔ, Q➔ㅂ, T➔ㅅ, L➔ㅣ, S➔ㄴ</span>)해 보세요.",
        "• 위에서 분비되어 단백질을 1차 분해하는 대표 소화효소의 이름(<span class=\"text-green-400 font-bold\">한글 2글자</span>)이 완성됩니다."
      ]
    }
  },
  chart2: {
    step1: {
      title: "💡 문제풀이 힌트",
      lines: [
        "• <span class=\"text-red-400 font-bold\">온몸 순환 5단계:</span> 좌심실(15) ➔ 대동맥(3) ➔ 온몸(20) ➔ 대정맥(4) ➔ 우심방(6)",
        "• <span class=\"text-cyan-400 font-bold\">허파 순환 5단계:</span> 우심실(9) ➔ 폐동맥(1) ➔ 폐(10) ➔ 폐정맥(2) ➔ 좌심방(5)"
      ]
    },
    step2: {
      title: "🔑 암호 힌트",
      lines: [
        "• <span class=\"text-amber-400 font-bold\">코드 A (온몸 순환):</span> 홀수 번째인 1, 3, 5단계 번호의 합산입니다 (15 + 20 + 6 = <span class=\"text-white font-bold orb\">41</span>).",
        "• <span class=\"text-cyan-400 font-bold\">코드 B (허파 순환):</span> 단계별 누적 연산입니다 (출발 9 + 폐 10 = 19 ➔ 귀환로 2 + 도착 5 합산 = <span class=\"text-white font-bold orb\">29</span>).",
        "• 최종 코드는 앞 2자리(A)와 뒤 2자리(B)를 연결한 <span class=\"text-green-400 font-bold orb text-base\">4자리 숫자</span>입니다."
      ]
    }
  },
  chart3: {
    step1: {
      title: "💡 문제풀이 힌트",
      lines: [
        "• 미션지 우측 하단 점선을 뒤로 접어 벽면 <span class=\"text-cyan-400 font-bold\">[호흡기 포스터]</span>의 반쪽 QR과 정확히 겹친 뒤 스캔하세요.",
        "• 폐포와 모세혈관 사이에서 기체가 농도 차에 의해 이동하는 2글자 핵심 현상은 <span class=\"text-amber-400 font-bold\">확산</span>입니다."
      ]
    },
    step2: {
      title: "🔑 암호 힌트",
      lines: [
        "• <span class=\"text-amber-400 font-bold\">1~2번 자리:</span> '확'의 한글 획수(8) + '산'의 한글 획수(5) ➔ <span class=\"text-white font-bold orb\">85</span>",
        "• <span class=\"text-cyan-400 font-bold\">3~4번 자리:</span> 산소 기체 분자식(O₂)의 아래 첨자(2) + 이산화탄소(CO₂) 속 산소 원자 수(2) ➔ <span class=\"text-white font-bold orb\">22</span>",
        "• 4자리 숫자를 차례대로 결합한 <span class=\"text-green-400 font-bold orb text-base\">4자리 암호</span>를 입력하세요."
      ]
    }
  },
  chart4: {
    step1: {
      title: "💡 문제풀이 힌트",
      lines: [
        "• 사구체에서 여과되지 않는 물질(여과액 0.00%인 <span class=\"text-red-400 font-bold\">혈구, 단백질</span>)에 ❌표 하세요.",
        "• 세뇨관에서 전량 재흡수되는 물질(오줌 0.00%인 <span class=\"text-amber-400 font-bold\">포도당, 아미노산</span>)에 ❌표 하세요."
      ]
    },
    step2: {
      title: "🔑 암호 힌트",
      lines: [
        "• 소거 후 남는 물질 중 번호가 홀수인 것은 <span class=\"text-amber-400 font-bold\">① 요소</span>와 <span class=\"text-cyan-400 font-bold\">⑤ 물</span>입니다.",
        "• ① 요소의 고유 코드(37)와 ⑤ 물의 고유 코드(09)를 순서대로 이어 붙인 <span class=\"text-green-400 font-bold orb text-base\">4자리 암호</span>가 정답입니다."
      ]
    }
  }
};
function initHints() {
      const hints = window.GAME_HINTS || DEFAULT_HINTS;

      function renderChartHints(chartKey, containerId, prefix) {
        const cData = hints[chartKey] || DEFAULT_HINTS[chartKey];
        const container = document.getElementById(containerId);
        if (!container || !cData) return;

        let htmlStr = '';

        if (cData.step1) {
          const idA = prefix + 'a';
          const linesA = (cData.step1.lines || []).map(l => '<p>' + l + '</p>').join('');
          htmlStr += `
        <button onclick="tHint('${idA}')" class="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#0f1628]/60 border border-amber-900/30 text-left hover:border-amber-500/40 transition-all">
          <span class="text-amber-400 text-sm font-bold">${cData.step1.title || '💡 1단계 힌트'}</span><span id="${idA}-ic" class="text-amber-400">▼</span>
        </button>
        <div id="${idA}" class="hint-content">
          <div class="px-4 py-3 bg-amber-900/10 rounded-b-xl border border-amber-900/20 text-sm text-slate-300 space-y-1">
            ${linesA}
          </div>
        </div>
      `;
        }

        if (cData.step2) {
          const idB = prefix + 'b';
          const linesB = (cData.step2.lines || []).map(l => '<p>' + l + '</p>').join('');
          htmlStr += `
        <button onclick="tHint('${idB}')" class="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#0f1628]/60 border border-cyan-900/30 text-left hover:border-cyan-500/40 transition-all">
          <span class="text-cyan-400 text-sm font-bold">${cData.step2.title || '💡 2단계 힌트'}</span><span id="${idB}-ic" class="text-cyan-400">▼</span>
        </button>
        <div id="${idB}" class="hint-content">
          <div class="px-4 py-3 bg-cyan-900/10 rounded-b-xl border border-cyan-900/20 text-sm text-slate-300 space-y-1">
            ${linesB}
          </div>
        </div>
      `;
        }

        container.innerHTML = htmlStr;
      }

      renderChartHints('chart1', 'hints-chart1', 'h1');
      renderChartHints('chart2', 'hints-chart2', 'h2');
      renderChartHints('chart3', 'hints-chart3', 'h3');
      renderChartHints('chart4', 'hints-chart4', 'h4');
    }

    initHints();
    updTimer(); updVitals();
  