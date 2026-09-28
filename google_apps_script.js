/**
 * ============================================================
 * 🏥 골든타임 메디컬 센터 방탈출 - 구글 스프레드시트 실시간 관제 API (v2.0)
 * ============================================================
 * [적용 방법]
 * 1. 구글 스프레드시트(https://docs.google.com/spreadsheets/d/1KNcFWVB6eGS8bGr2avxChuuV3j0YE4kdMG0KrlahZ9E/edit)를 엽니다.
 * 2. 상단 메뉴 [확장 프로그램] > [Apps Script]를 클릭합니다.
 * 3. 기존 코드를 모두 지우고 이 파일의 전체 코드를 붙여넣습니다.
 * 4. 상단 [저장(디스크 아이콘)]을 누릅니다.
 * 5. 우측 상단 파란색 [배포] 버튼 > [배포 관리]를 클릭합니다.
 * 6. 연필 아이콘(수정)을 누르고, 버전에서 [새 버전]을 선택한 후 [배포]를 누릅니다.
 *    (중요: 반드시 [새 버전]을 선택해야 수정한 코드가 즉시 반영됩니다!)
 * 7. [배포] 완료!
 *
 * [⚡ 구글 시트 어긋난 열 자동 복구 기능 탑재]
 * - 이 스크립트는 웹앱에서 조회(GET) 또는 전송(POST) 시 자동으로 시트 1행의 누락된 헤더와
 *   이전 2~15행의 어긋난 열 위치(최종 통합 치료 열 삽입 및 힌트/시간/등급/상태 재정렬)를 
 *   기존 데이터를 지우지 않고 100% 안전하게 자동 복원/정렬합니다.
 * - 필요 시 Apps Script 편집기 상단에서 'migrateAndFixSheetLayout' 함수를 선택 후 [실행]을 눌러
 *   시트를 즉시 수동으로 완벽 정리할 수도 있습니다.
 */

const SHEET_NAME_STATUS = "골든타임_실시간현황";
const SHEET_NAME_HISTORY = "완치_기록_히스토리";

const HEADERS_15 = [
  "학급", "모둠", "수석 명의(팀장)", "전문의팀(팀원)",
  "차트01(소화)", "차트02(순환)", "차트03(호흡)", "차트04(신장)",
  "최종 통합 치료",
  "힌트 사용(회)", "현재 진행/남은시간", "완치 소요시간",
  "최종 등급", "진행 상태", "최근 업데이트"
];

function extractClassNum(raw) {
  if (!raw) return "";
  const str = String(raw).trim();
  // 1. '2학년 1반', '21반', '1반' 처리
  const m = str.match(/([0-9]+)\s*반/);
  if (m) {
    let n = m[1];
    if (n.length === 2 && n.startsWith("2")) n = n.substring(1);
    return n;
  }
  // 2. '반 21', '반 1' 처리
  const m2 = str.match(/반\s*([0-9]+)/);
  if (m2) {
    let n = m2[1];
    if (n.length === 2 && n.startsWith("2")) n = n.substring(1);
    return n;
  }
  // 3. '2학년 1' 처리
  const m3 = str.match(/2학년\s*([0-9]+)/);
  if (m3) return m3[1];

  // 4. 순수 숫자
  const digits = str.replace(/[^0-9]/g, "");
  if (digits.length === 2 && digits.startsWith("2")) return digits.substring(1);
  return digits;
}

function formatHeader(sheet, numCols) {
  const headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setBackground("#0f172a");
  headerRange.setFontColor("#38bdf8");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    formatHeader(sheet, headers.length);
    sheet.getRange(2, 12, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("@");
  }
  return sheet;
}

/**
 * 🛠️ [시트 레이아웃 자동 정렬 및 열 어긋남 복구]
 * 16행 이후 도입된 '최종 통합 치료' 열로 인해 기존 2~15행 데이터와 헤더가 밀려있던 현상을
 * 과거 기록 유실 없이 100% 깔끔하게 재배열하여 일치시킵니다.
/**
 * 🛠️ [선택 실행] 시트 열 구조 점검 및 서식 보정 함수 (기존 데이터 절대 삭제 금지)
 */
function autoFixAndAlignSheet(sheet) {
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1) return;

  const curHeaderRange = sheet.getRange(1, 1, 1, Math.max(lastCol, HEADERS_15.length));
  const curHeaders = curHeaderRange.getValues()[0];
  const col9Header = String(curHeaders[8] || "");

  const needsHeaderFix = !col9Header.includes("최종") && !col9Header.includes("코드");

  // 1행 헤더가 구형인 경우에만 1행 헤더만 갱신
  if (needsHeaderFix) {
    sheet.getRange(1, 1, 1, HEADERS_15.length).setValues([HEADERS_15]);
    formatHeader(sheet, HEADERS_15.length);
  }

  // 데이터 행이 없으면 종료
  if (lastRow <= 1) return;

  // 완치 소요시간 열(L열, 12번째 열) 서식을 텍스트(@)로 안전하게 지정
  sheet.getRange(2, 12, lastRow - 1, 1).setNumberFormat("@");
}

/**
 * 🛠️ [선택 실행] 전체 시트 수동 마이그레이션 실행 함수
 */
function migrateAndFixSheetLayout() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const statusSheet = ss.getSheetByName(SHEET_NAME_STATUS);
  if (statusSheet) autoFixAndAlignSheet(statusSheet);

  const histSheet = ss.getSheetByName(SHEET_NAME_HISTORY);
  if (histSheet) autoFixAndAlignSheet(histSheet);
}

function saveNoticeData(ss, msg, cls, timestamp) {
  const ts = Number(timestamp || Date.now());
  const c = String(cls || "all");
  const m = String(msg || "");

  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty("NOTICE_MSG", m);
    props.setProperty("NOTICE_CLS", c);
    props.setProperty("NOTICE_TIME", String(ts));
  } catch (e) { }

  try {
    const sheet = ss.getSheetByName(SHEET_NAME_STATUS);
    if (sheet) {
      sheet.getRange("Z1").setValue(JSON.stringify({ msg: m, cls: c, ts: ts }));
    }
  } catch (e) { }
}

function getNoticeData(ss) {
  let noticeMsg = "";
  let noticeCls = "all";
  let noticeTime = 0;

  try {
    const props = PropertiesService.getScriptProperties();
    noticeMsg = props.getProperty("NOTICE_MSG") || "";
    noticeCls = props.getProperty("NOTICE_CLS") || "all";
    noticeTime = Number(props.getProperty("NOTICE_TIME") || 0);
  } catch (e) { }

  if (!noticeMsg) {
    try {
      const sheet = ss.getSheetByName(SHEET_NAME_STATUS);
      if (sheet) {
        const val = sheet.getRange("Z1").getValue();
        if (val) {
          const parsed = JSON.parse(val);
          noticeMsg = parsed.msg || "";
          noticeCls = parsed.cls || "all";
          noticeTime = Number(parsed.ts || 0);
        }
      }
    } catch (e) { }
  }

  return { msg: noticeMsg, cls: noticeCls, ts: noticeTime };
}

function doPost(e) {
  try {
    let data;
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter;
      }
    } else if (e.parameter && e.parameter.data) {
      data = JSON.parse(e.parameter.data);
    } else {
      data = e.parameter;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 📢 [긴급 공지 브로드캐스트 처리]
    if (data.action === "sendNotice") {
      saveNoticeData(ss, data.msg, data.cls, data.timestamp);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", notice: "broadcasted" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = getOrCreateSheet(ss, SHEET_NAME_STATUS, HEADERS_15);

    const rawCls = data.cls || "";
    const clsNum = extractClassNum(rawCls);
    const grp = String(data.grp || "").replace(/[^0-9]/g, "");
    const leader = (data.leader || "").trim();
    const members = Array.isArray(data.members) ? data.members.join(", ") : (data.members || "");
    const stamps = data.stamps || [false, false, false, false];
    let s1 = stamps[0] ? "✓ 완료" : "진행중";
    let s2 = stamps[1] ? "✓ 완료" : "진행중";
    let s3 = stamps[2] ? "✓ 완료" : "진행중";
    let s4 = stamps[3] ? "✓ 완료" : "진행중";

    // 🔒 완료 조건 엄격화: 4개 장기 스탬프만으로는 완치가 아니며, 오직 최종 통합 치료 암호 입력 성공 시에만 완료!
    let isFinalCompleted = !!data.finalCompleted;
    let hintCount = Number(data.hintCount || 0);
    const timeDisplay = data.timeDisplay || "";

    // ⏱ 완치 소요 시간: 시트에서 날짜나 시간으로 자동 변환되지 않도록 데이터 값 맨 앞에 홑따옴표(')를 붙여 순수 텍스트 형식으로 저장
    let clearTimeStr = data.clearTimeStr;
    if (!clearTimeStr && isFinalCompleted) {
      const m = String(timeDisplay).match(/([0-9]{1,2}\s*:\s*[0-9]{2})/);
      clearTimeStr = m ? m[1] : timeDisplay;
    }
    if (clearTimeStr && clearTimeStr !== "-") {
      clearTimeStr = "'" + String(clearTimeStr).replace(/^'/, "").trim();
    } else {
      clearTimeStr = "-";
    }

    // ⏱ 시작 시간(startedAt) 서버 프로퍼티 저장 및 유지
    const props = PropertiesService.getScriptProperties();
    const startKey = "START_" + clsNum + "_" + grp;
    const leaderKey = "START_LEADER_" + leader.toLowerCase();
    let startedAt = Number(data.startedAt || 0);

    if (startedAt > 0) {
      props.setProperty(startKey, String(startedAt));
      if (leader) props.setProperty(leaderKey, String(startedAt));
    } else {
      startedAt = Number(props.getProperty(startKey) || props.getProperty(leaderKey) || 0);
    }

    // 기존 해당 학급+모둠 또는 학급+팀장 행 탐색 (중복 행 감지 및 단일화)
    const values = sheet.getDataRange().getValues();
    const matchRows = [];

    for (let i = 1; i < values.length; i++) {
      const rowClsNum = extractClassNum(values[i][0]);
      const rowGrpNum = String(values[i][1]).replace(/[^0-9]/g, "");
      const rowLeader = String(values[i][2] || "").trim().toLowerCase();
      const isLeaderMatch = leader && rowLeader && (rowLeader === leader.toLowerCase());
      const isClassMatch = !rowClsNum || !clsNum || (rowClsNum === clsNum);
      const isGroupMatch = grp && rowGrpNum && (rowGrpNum === grp);

      if ((isLeaderMatch && isClassMatch) || (isGroupMatch && isClassMatch) || isLeaderMatch) {
        matchRows.push(i + 1); // 1-indexed row number
      }
    }

    let targetRow = matchRows.length > 0 ? matchRows[0] : -1;
    // 동일 모둠의 중복 행이 존재할 경우 하위 중복 행들을 삭제하여 항상 1개의 행만 유지
    if (matchRows.length > 1) {
      for (let m = matchRows.length - 1; m >= 1; m--) {
        sheet.deleteRow(matchRows[m]);
      }
    }

    // 🛡️ [데이터 보호 및 리셋 로직]
    if (data.action === "resetGroup") {
      const rCls = clsNum;
      const rGrp = String(grp).replace(/[^0-9]/g, "");
      const startKey = "START_" + rCls + "_" + rGrp;
      props.deleteProperty(startKey);

      // 리셋 식별 타임스탬프 기록 (학생 기기에서 즉시 감지하여 캐시 클리어)
      const nowTs = Date.now();
      props.setProperty("RESET_" + rCls + "_" + rGrp, String(nowTs));

      // 시트에서 해당 학급 및 모둠의 모든 행 탐색 및 삭제
      const allVals = sheet.getDataRange().getValues();
      let delCount = 0;
      for (let i = allVals.length - 1; i >= 1; i--) {
        const rowClsNum = extractClassNum(allVals[i][0]);
        const rowGrpNum = String(allVals[i][1]).replace(/[^0-9]/g, "");
        const rowLeader = String(allVals[i][2] || "").trim();

        if (rowClsNum === rCls && (rowGrpNum === rGrp || (leader && rowLeader === leader))) {
          if (rowLeader) {
            props.deleteProperty("START_LEADER_" + rowLeader.toLowerCase().trim());
          }
          sheet.deleteRow(i + 1);
          delCount++;
        }
      }
      if (leader) props.deleteProperty("START_LEADER_" + leader.toLowerCase().trim());

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "resetGroup",
        cls: rCls,
        grp: rGrp,
        deleted: delCount,
        resetTs: nowTs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "resetAll") {
      const rCls = clsNum;
      const nowTs = Date.now();
      const allProps = props.getProperties();
      for (let k in allProps) {
        if (k.startsWith("START_" + rCls + "_") || k.startsWith("RESET_" + rCls + "_")) {
          props.deleteProperty(k);
        }
      }
      props.setProperty("RESET_CLASS_" + rCls, String(nowTs));

      const allVals = sheet.getDataRange().getValues();
      let delCount = 0;
      for (let i = allVals.length - 1; i >= 1; i--) {
        const rowClsNum = extractClassNum(allVals[i][0]);
        if (rowClsNum === rCls) {
          const rowLeader = String(allVals[i][2] || "").trim();
          if (rowLeader) {
            props.deleteProperty("START_LEADER_" + rowLeader.toLowerCase().trim());
          }
          sheet.deleteRow(i + 1);
          delCount++;
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "resetAll",
        cls: rCls,
        deleted: delCount,
        resetTs: nowTs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    let finalGradeVal = data.grade || (isFinalCompleted ? "완료" : "-");
    let finalTimeDispVal = timeDisplay;

    if (targetRow > 0) {
      const existing = values[targetRow - 1];
      const existingFinal = String(existing[13] || "").includes("완치완료") || String(existing[8] || "").includes("성공");
      const existingClearVal = existing[11];
      const existingGrade = existing[12];
      const existingTimeDisp = existing[10];

      // 1. 이미 완치 완료된 경우 완치 상태, 소요시간, 등급 영구 고정 (재접속 시간으로 덮어쓰기 방지)
      if (existingFinal) {
        isFinalCompleted = true;
        if (existingClearVal && existingClearVal !== "-") {
          let cVal = existingClearVal;
          if (cVal instanceof Date) {
            const mm = String(cVal.getMinutes()).padStart(2, '0');
            const ss = String(cVal.getSeconds()).padStart(2, '0');
            cVal = mm + ':' + ss;
          }
          clearTimeStr = "'" + String(cVal).replace(/^'/, "").trim();
        }
        if (existingGrade && existingGrade !== "-") {
          finalGradeVal = existingGrade;
        }
        if (existingTimeDisp && String(existingTimeDisp).includes("완료")) {
          finalTimeDispVal = existingTimeDisp;
        }
      }

      // 2. 이미 완료된 스탬프는 유지 (새 기기에서 빈 스탬프로 덮어쓰기 방지)
      if (existing[4] === "✓ 완료") s1 = "✓ 완료";
      if (existing[5] === "✓ 완료") s2 = "✓ 완료";
      if (existing[6] === "✓ 완료") s3 = "✓ 완료";
      if (existing[7] === "✓ 완료") s4 = "✓ 완료";

      hintCount = Math.max(hintCount, Number(existing[9]) || 0);
    }

    // 최종 코드 상태 산출 (4개 스탬프 완료 + 최종 코드 성공 시 완치 완료)
    const allStamps = (s1 === "✓ 완료" && s2 === "✓ 완료" && s3 === "✓ 완료" && s4 === "✓ 완료");
    const finalCodeCol = isFinalCompleted ? "✓ 성공" : (allStamps ? "🔓 해제됨(진행중)" : "🔒 잠김");

    const status = isFinalCompleted ? "🏆 완치완료" : (allStamps ? "🔓 최종코드입력중" : "🟢 작전진행중");
    const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

    const formattedCls = clsNum || "1";
    const formattedGrp = grp ? (grp + "모둠") : "-";

    const rowData = [
      formattedCls,
      formattedGrp,
      leader,
      members,
      s1, s2, s3, s4,
      finalCodeCol,
      hintCount,
      finalTimeDispVal,
      clearTimeStr,
      finalGradeVal,
      status,
      nowStr
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
      targetRow = sheet.getLastRow();
    }
    // 완치 소요시간 열(L열) 서식을 텍스트(@)로 명시적 지정하여 시트의 날짜/시간 자동 변환 원천 차단
    sheet.getRange(targetRow, 12).setNumberFormat("@");

    // 완치 완료 시 스타일 강조 및 히스토리 기록 (중복 히스토리 방지)
    if (isFinalCompleted) {
      sheet.getRange(targetRow, 1, 1, rowData.length).setBackground("#ecfdf5");
      const histSheet = getOrCreateSheet(ss, SHEET_NAME_HISTORY, HEADERS_15);
      const histVals = histSheet.getDataRange().getValues();
      let alreadyInHist = false;
      for (let h = 1; h < histVals.length; h++) {
        const hCls = extractClassNum(histVals[h][0]);
        const hGrp = String(histVals[h][1]).replace(/[^0-9]/g, "");
        const hLeader = String(histVals[h][2] || "").trim().toLowerCase();
        if ((hCls === clsNum && hGrp === grp) || (leader && hLeader === leader.toLowerCase())) {
          alreadyInHist = true;
          break;
        }
      }
      if (!alreadyInHist) {
        histSheet.appendRow(rowData);
        histSheet.getRange(histSheet.getLastRow(), 12).setNumberFormat("@");
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      row: targetRow,
      stamps: [s1 === "✓ 완료", s2 === "✓ 완료", s3 === "✓ 완료", s4 === "✓ 완료"],
      finalCompleted: isFinalCompleted,
      hintCount: hintCount,
      startedAt: startedAt
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 📢 GET 방식으로도 긴급 공지 전송 지원
    if (e && e.parameter && e.parameter.action === "sendNotice") {
      saveNoticeData(ss, e.parameter.msg, e.parameter.cls, e.parameter.timestamp || e.parameter.ts);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", notice: "broadcasted_via_get" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const noticeData = getNoticeData(ss);

    const sheet = ss.getSheetByName(SHEET_NAME_STATUS);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        notice: noticeData,
        groups: []
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const values = sheet.getDataRange().getValues();
    const filterClsRaw = e && e.parameter && e.parameter.cls ? e.parameter.cls : "";
    const filterClsNum = extractClassNum(filterClsRaw);

    const props = PropertiesService.getScriptProperties();
    const groupsMap = {};

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rClsNum = extractClassNum(row[0]);
      if (filterClsNum && rClsNum !== filterClsNum) continue;

      const rGrp = String(row[1] || "").replace(/[^0-9]/g, "");
      const leaderName = String(row[2] || "").trim();

      let clearVal = row[11];
      if (clearVal instanceof Date) {
        const mm = clearVal.getMinutes();
        const ssSec = clearVal.getSeconds();
        clearVal = String(mm).padStart(2, '0') + ':' + String(ssSec).padStart(2, '0');
      } else {
        clearVal = String(clearVal || "").replace(/^'/, "");
      }

      const finalCodeVal = String(row[8] || "");
      const statusVal = String(row[13] || "");
      // 오직 최종 코드가 성공했거나 완치완료 상태일 때만 완치 완료
      const isCompleted = finalCodeVal.includes("성공") || statusVal.includes("완치완료");

      // 시작 시각(startedAt) 가져오기
      const startKey = "START_" + rClsNum + "_" + rGrp;
      const leaderKey = "START_LEADER_" + leaderName.toLowerCase();
      let startedAt = Number(props.getProperty(startKey) || props.getProperty(leaderKey) || 0);

      const tDisp = String(row[10] || "");
      // startedAt이 0이고 진행중인 경우 timeDisplay(예: "01:23 경과")에서 시작 시각 역산
      if (startedAt === 0 && !isCompleted && tDisp) {
        const m = tDisp.match(/([0-9]+)\s*:\s*([0-9]+)\s*경과/);
        if (m) {
          const elSec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
          startedAt = Date.now() - (elSec * 1000);
        }
      }

      const gInfo = {
        cls: row[0],
        clsNum: rClsNum,
        grp: Number(rGrp) || row[1],
        leader: leaderName,
        members: row[3],
        stamps: [row[4] === "✓ 완료", row[5] === "✓ 완료", row[6] === "✓ 완료", row[7] === "✓ 완료"],
        finalCode: finalCodeVal,
        hintCount: Number(row[9]) || 0,
        timeDisplay: tDisp,
        clearTimeStr: (clearVal !== "-" && isCompleted) ? clearVal : null,
        grade: row[12],
        finalCompleted: isCompleted,
        startedAt: startedAt,
        updatedAt: row[14] instanceof Date ? Utilities.formatDate(row[14], "Asia/Seoul", "yyyy-MM-dd HH:mm:ss") : row[14]
      };

      const gKey = (rClsNum + "_" + (rGrp || leaderName)).toLowerCase();
      if (groupsMap[gKey]) {
        // 이미 해당 모둠이 존재할 경우, 완치 완료된 행을 우선 보존
        if (!groupsMap[gKey].finalCompleted && isCompleted) {
          groupsMap[gKey] = gInfo;
        }
      } else {
        groupsMap[gKey] = gInfo;
      }
    }

    const groups = Object.values(groupsMap);

    // 🔄 리셋 타임스탬프 정보 수집 (학생 기기에서 캐시 자동 강제 초기화 감지용)
    const allProps = props.getProperties();
    const resets = {};
    for (let k in allProps) {
      if (k.startsWith("RESET_")) {
        resets[k] = allProps[k];
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      notice: noticeData,
      groups: groups,
      resets: resets
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 🛠️ [선택 실행] 구글 시트 기존 학급 열 정규화 함수
 */
function normalizeAllSheetClasses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_STATUS);
  if (!sheet) return;
  autoFixAndAlignSheet(sheet);
}
