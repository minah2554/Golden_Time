const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

console.log('1. Contains admin1234:', html.includes('admin1234'));
console.log('2. Plaintext minah string literals (/["\']minah["\']/):', /["']minah["']/.test(html));
console.log('3. Contains id="t-class-badge":', html.includes('id="t-class-badge"'));
console.log('4. Contains resetAllGroups:', html.includes('resetAllGroups'));
console.log('5. Contains resetGroupData:', html.includes('resetGroupData'));
console.log('6. Contains tDashInterval (auto timer):', html.includes('tDashInterval'));
console.log('7. Contains 진행 시간:', html.includes('진행 시간:'));
console.log('8. Code input font Pretendard:', html.includes("font-family: 'Pretendard', sans-serif !important;"));
console.log('9. Clean labels 🔑 치료 암호:', (html.match(/🔑 치료 암호/g) || []).length);
console.log('10. Answers check:', html.includes("ANS = { 1: '펩신', 2: '4129', 3: '8522', 4: '3709', 5: '3817' }"));
