const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const badSnippet = `  toast('모든 모둠의 데이터가 전체 초기화되었습니다.', 'ok');
}unction resetAllGroups() {
  if (!confirm('⚠️ 전체 학급/모둠의 진행 데이터를 모두 초기화하고 처음으로 리셋하시겠습니까?\\n(현재 연결된 모든 학생 화면도 초기 로그인 화면으로 돌아갑니다)')) return;
  for (let g = 1; g <= 6; g++) {
    try { localStorage.removeItem('esc_' + g); } catch(e) {}
    delete grpStates[g];
  }
  sendBC('RESET_ALL');
  renderTGroups();
  toast('전체 모둠 데이터가 일괄 초기화되었습니다.', 'ok');
  setTimeout(() => location.reload(), 600);
}`;

const goodSnippet = `  toast('모든 모둠의 데이터가 전체 초기화되었습니다.', 'ok');
}`;

if (html.includes(badSnippet)) {
  html = html.replace(badSnippet, goodSnippet);
  fs.writeFileSync('index.html', html, 'utf8');
  console.log('[SUCCESS] Fixed syntax error cleanly!');
} else {
  // 대체 매칭
  const regex = /toast\('모든 모둠의 데이터가 전체 초기화되었습니다\.', 'ok'\);\s*\}unction resetAllGroups\(\)[\s\S]*?setTimeout\(\(\) => location\.reload\(\), 600\);\s*\}/;
  if (regex.test(html)) {
    html = html.replace(regex, "toast('모든 모둠의 데이터가 전체 초기화되었습니다.', 'ok');\n}");
    fs.writeFileSync('index.html', html, 'utf8');
    console.log('[SUCCESS] Regex replaced syntax error cleanly!');
  } else {
    console.log('[ERROR] Snippet not matched');
  }
}
