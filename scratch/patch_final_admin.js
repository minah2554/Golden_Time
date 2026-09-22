const fs = require('fs');

const htmlPath = 'd:/바이브 코딩/중2 소화 온오프라인 방탈출/골든타임 메디컬센터 방탈출/index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. 주석 19행에 남아있던 admin1234 제거
html = html.replace(/★ 교사 관리자 비밀번호: admin1234[^\r\n]*/g, '★ 교사 관리자 모드: 비밀번호 보안 인증 적용');

// 2. modal-teacher 헤더 교체 (배지 + 전체 리셋 버튼)
const targetHeader = `<div class="flex items-center justify-between mb-5">
          <div>
            <div class="orb text-amber-400 font-bold text-lg">👨‍⚕️ 교사 대시보드</div>
            <div class="text-slate-500 text-xs mt-1">실시간 모둠 진행 현황</div>
          </div>
          <button onclick="closeModal('modal-teacher')"
            class="text-slate-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-all">✕</button>
        </div>`;

const newHeader = `<div class="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-cyan-900/40 pb-4">
          <div class="flex items-center gap-3">
            <div class="text-2xl">👨‍⚕️</div>
            <div>
              <div class="flex items-center gap-2">
                <span class="orb text-amber-400 font-bold text-lg">교사 관제 대시보드</span>
                <span id="t-class-badge" class="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-400/50 text-cyan-300 font-bold text-xs">🏥 학급 관제</span>
              </div>
              <div class="text-slate-400 text-xs mt-0.5">실시간 모둠별 진행 시간 및 힌트 사용 현황 관제탑</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="resetAllGroups()" class="px-3 py-1.5 rounded-lg bg-red-950/80 border border-red-700 text-red-300 hover:bg-red-900 text-xs font-bold transition-all shadow-md flex items-center gap-1.5">
              ⚠️ 전체 모둠 초기화
            </button>
            <button onclick="closeModal('modal-teacher')"
              class="text-slate-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-all">✕</button>
          </div>
        </div>`;

if (html.includes(targetHeader)) {
  html = html.replace(targetHeader, newHeader);
  console.log('[OK] Replaced modal-teacher header');
} else {
  console.log('[WARN] Target header not found by exact string, checking alternate...');
}

// 3. onBC 핸들러 확장 (진행시간, 힌트수, 리셋 연동)
const targetOnBC = `function onBC(msg) {
      if (msg.type === 'BROADCAST_NOTICE') { showBCModal(msg.data.msg); snd('alarm'); }
      if (msg.type === 'TIMER_CTRL') {
        if (msg.data.a === 'pause') togglePause();
        if (msg.data.a === 'add5') { G.sec = Math.min(G.sec + 300, 99 * 60); updTimer(); }
        if (msg.data.a === 'reset') { G.sec = 35 * 60; updTimer(); }
      }
      if (msg.type === 'FORCE_APPROVE' && (msg.data.grp === G.player.grp || msg.data.grp === 'all')) approveStamp(msg.data.n);
      if (msg.type === 'REQ_STATE') sendBC('STUDENT_STATE', { grp: G.player.grp, leader: G.player.leader, stamps: G.stamps });
      if (msg.type === 'STUDENT_STATE') { grpStates[msg.data.grp] = msg.data; renderTGroups(); }
    }`;

const newOnBC = `function onBC(msg) {
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
    }`;

if (html.includes(targetOnBC)) {
  html = html.replace(targetOnBC, newOnBC);
  console.log('[OK] Replaced onBC handler');
} else {
  console.log('[WARN] targetOnBC not found directly');
}

// 4. 교사 모달 제어 및 인증 로직 + 실시간 진행 시간 렌더링
const startMarker = `// ============================================================
// 🔒 [교사용 보안 인증] 소스 검색으로도 비밀번호가 노출되지 않도록 해시 시그니처 검증
// ============================================================`;
const endMarker = `// 교사 관리자: 전체 모둠 일괄 리셋 (수업 초기화)
function resetAllGroups() {
  if (!confirm('⚠️ 전체 학급/모둠의 진행 데이터를 모두 초기화하고 처음으로 리셋하시겠습니까?\\n(현재 연결된 모든 학생 화면도 초기 로그인 화면으로 돌아갑니다)')) return;
  for (let g = 1; g <= 6; g++) {
    try { localStorage.removeItem('esc_' + g); } catch(e) {}
    delete grpStates[g];
  }
  sendBC('RESET_ALL');
  renderTGroups();`;

const newTeacherSection = `// ============================================================
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

    htmlStr += \`
      <div class="teacher-card p-3.5 rounded-xl bg-[#0f1628]/90 border border-cyan-900/40 shadow-lg flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-center mb-1.5">
            <span class="orb text-cyan-400 text-sm font-black">\${g}모둠</span>
            \${statusBadge}
          </div>
          <div class="text-white text-sm font-bold mb-0.5 truncate flex items-center gap-1.5">
            <span>\${s && s.cls ? s.cls + '반 ' : ''}</span>
            <span class="text-cyan-200">\${leaderName}</span>
          </div>
          \${memberStr}
          <div class="flex items-center justify-between mt-2 mb-1 bg-slate-950/50 p-1.5 rounded">
            <span class="text-[11px] text-slate-400">치료 진척도:</span>
            <span class="text-amber-400 text-xs font-black">\${cnt} / 4 완료</span>
          </div>
          <div class="flex justify-center gap-2 my-2 py-1 bg-slate-900/40 rounded border border-slate-800/40">\${si}</div>
          \${hintBadge}
          \${timeBadge}
        </div>
        \${resetBtn}
      </div>
    \`;
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
  if (!confirm('⚠️ 전체 1~6모둠의 진행 상황과 힌트 기록을 모두 초기화하시겠습니까?\\n(새로운 수업이나 반 변경 시 사용합니다)')) return;
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
}`;

// closeModal 함수에서 tDashInterval 정지 처리
if (html.includes("function closeModal(id) {")) {
  html = html.replace(
    "function closeModal(id) {",
    "function closeModal(id) { if (id === 'modal-teacher' && tDashInterval) { clearInterval(tDashInterval); tDashInterval = null; }"
  );
  console.log('[OK] Added modal-teacher interval cleanup to closeModal');
}

const sIdx = html.indexOf(startMarker);
const eIdx = html.indexOf(endMarker);

if (sIdx !== -1 && eIdx !== -1) {
  // endMarker 이후의 `toast('전체 모둠이 초기화되었습니다.', 'ok');\n}` 까지를 포괄
  const sub = html.slice(eIdx);
  const endFnIdx = sub.indexOf("toast('전체 모둠이 초기화되었습니다.', 'ok');\n}");
  const cutEnd = eIdx + endFnIdx + "toast('전체 모둠이 초기화되었습니다.', 'ok');\n}".length;
  
  html = html.slice(0, sIdx) + newTeacherSection + html.slice(cutEnd);
  console.log('[OK] Replaced teacher management section cleanly');
} else {
  console.log('[WARN] Markers not found: sIdx =', sIdx, 'eIdx =', eIdx);
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Successfully updated index.html!');
