fetch('https://golden-time-medical.vercel.app/')
  .then(res => res.text())
  .then(t => {
    console.log('1. Live HTML size:', t.length);
    console.log('2. Has t-class-badge:', t.includes('id="t-class-badge"'));
    console.log('3. Has minah SHA-256 hash:', t.includes('ad5f52f58ed6ec6e7a641f2416f347674ac5933470079f2a18bc6269b1e80796'));
    console.log('4. Has resetAllGroups:', t.includes('resetAllGroups'));
    console.log('5. Has team progress time:', t.includes('진행 시간:'));
    console.log('6. No admin1234:', !t.includes('admin1234'));
  })
  .catch(err => console.error(err));
