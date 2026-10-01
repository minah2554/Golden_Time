/**
 * ============================================================
 * 🏥 골든타임 메디컬 센터 방탈출 - 구글 스프레드시트 실시간 관제 API (v3.0)
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
 * [⚡ v3.0 주요 개선 사항]
 * 1. 세션 식별 고유키 강화: '반 + 모둠 + 팀장 이름' 3가지 값이 100% 일치할 때만 동일 세션으로 매칭
 * 2. 교사 대시보드 팀 데이터 리셋 완벽 구현: DB 상의 팀장/팀원/시작시간/완료상태/스탬프를 null/초기 상태로 비움
 * 3. 교사 대시보드 타이머 양방향 동기화(일시정지, +5분, 리셋) 상태값 저장 및 학생 기기 실시간 전달
 * 4. 장기 강제 승인(반/모둠별 타겟팅) 실시간 DB 스탬프 업데이트 및 학생 기기 푸시
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

function autoFixAndAlignSheet(sheet) {
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1) return;

  const curHeaderRange = sheet.getRange(1, 1, 1, Math.max(lastCol, HEADERS_15.length));
  const curHeaders = curHeaderRange.getValues()[0];
  const col9Header = String(curHeaders[8] || "");

  const needsHeaderFix = !col9Header.includes("최종") && !col9Header.includes("코드");
  if (needsHeaderFix) {
    sheet.getRange(1, 1, 1, HEADERS_15.length).setValues([HEADERS_15]);
    formatHeader(sheet, HEADERS_15.length);
  }

  if (lastRow <= 1) return;
  sheet.getRange(2, 12, lastRow - 1, 1).setNumberFormat("@");
}

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

// ⏱ 타이머 상태 관리 헬퍼
function updateTimerState(props, cls, cmd, ts) {
  const prefix = "TIMER_" + cls + "_";
  const nowTs = Number(ts || Date.now());

  let isPaused = props.getProperty(prefix + "isPaused") === "true";
  let addedSec = Number(props.getProperty(prefix + "addedSec") || 0);
  let pausedAt = Number(props.getProperty(prefix + "pausedAt") || 0);
  let pausedDuration = Number(props.getProperty(prefix + "pausedDuration") || 0);
  let resetTs = Number(props.getProperty(prefix + "resetTs") || 0);

  if (cmd === "pause") {
    if (!isPaused) {
      isPaused = true;
      pausedAt = nowTs;
      props.setProperty(prefix + "isPaused", "true");
      props.setProperty(prefix + "pausedAt", String(pausedAt));
    }
  } else if (cmd === "resume") {
    if (isPaused) {
      isPaused = false;
      if (pausedAt > 0) {
        pausedDuration += (nowTs - pausedAt);
      }
      props.setProperty(prefix + "isPaused", "false");
      props.setProperty(prefix + "pausedDuration", String(pausedDuration));
      props.setProperty(prefix + "pausedAt", "0");
    }
  } else if (cmd === "add5") {
    addedSec += 300;
    props.setProperty(prefix + "addedSec", String(addedSec));
  } else if (cmd === "reset") {
    resetTs = nowTs;
    addedSec = 0;
    isPaused = false;
    pausedAt = 0;
    pausedDuration = 0;
    props.setProperty(prefix + "resetTs", String(resetTs));
    props.setProperty(prefix + "addedSec", "0");
    props.setProperty(prefix + "isPaused", "false");
    props.setProperty(prefix + "pausedAt", "0");
    props.setProperty(prefix + "pausedDuration", "0");
  }

  props.setProperty(prefix + "updatedAt", String(nowTs));
}

function getAllTimerStates(props) {
  const timerStates = {};
  for (let c = 1; c <= 6; c++) {
    const prefix = "TIMER_" + c + "_";
    timerStates[String(c)] = {
      isPaused: props.getProperty(prefix + "isPaused") === "true",
      addedSec: Number(props.getProperty(prefix + "addedSec") || 0),
      pausedAt: Number(props.getProperty(prefix + "pausedAt") || 0),
      pausedDuration: Number(props.getProperty(prefix + "pausedDuration") || 0),
      resetTs: Number(props.getProperty(prefix + "resetTs") || 0),
      updatedAt: Number(props.getProperty(prefix + "updatedAt") || 0)
    };
  }
  return timerStates;
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
    const props = PropertiesService.getScriptProperties();

    // 📢 1. [긴급 공지 브로드캐스트]
    if (data.action === "sendNotice") {
      saveNoticeData(ss, data.msg, data.cls, data.timestamp);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", notice: "broadcasted" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ⏱ 2. [타이머 제어 동기화 (일시정지/재개/5분추가/리셋)]
    if (data.action === "timerCtrl") {
      const targetCls = extractClassNum(data.cls) || "1";
      const cmd = data.cmd;
      const ts = Number(data.timestamp || Date.now());
      if (targetCls === "all") {
        for (let c = 1; c <= 6; c++) updateTimerState(props, String(c), cmd, ts);
      } else {
        updateTimerState(props, targetCls, cmd, ts);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "timerCtrl",
        cls: targetCls,
        cmd: cmd,
        timerStates: getAllTimerStates(props)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ⚡ 3. [장기 강제 승인]
    if (data.action === "forceApprove") {
      const fCls = extractClassNum(data.cls) || "1";
      const fGrp = String(data.grp || "").replace(/[^0-9]/g, ""); // "1" ~ "6" or ""
      const organIdx = Number(data.organIndex); // 1: 소화, 2: 순환, 3: 호흡, 4: 신장
      const nowTs = Date.now();
      const sheet = getOrCreateSheet(ss, SHEET_NAME_STATUS, HEADERS_15);
      const values = sheet.getDataRange().getValues();

      const targetGrps = (fGrp && fGrp !== "all") ? [fGrp] : ["1", "2", "3", "4", "5", "6"];

      targetGrps.forEach(gNum => {
        let foundRow = -1;
        for (let i = 1; i < values.length; i++) {
          const rCls = extractClassNum(values[i][0]);
          const rGrp = String(values[i][1] || "").replace(/[^0-9]/g, "");
          if (rCls === fCls && rGrp === gNum) {
            foundRow = i + 1;
            break;
          }
        }

        const organCol = 4 + organIdx; // 5: 소화, 6: 순환, 7: 호흡, 8: 신장
        if (foundRow > 0) {
          sheet.getRange(foundRow, organCol).setValue("✓ 완료");
          sheet.getRange(foundRow, 15).setValue(Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss"));
        } else {
          // 행이 없다면 행 신규 생성
          const rowData = [
            fCls, gNum + "모둠", "교사 강제승인", "-",
            organIdx === 1 ? "✓ 완료" : "진행전",
            organIdx === 2 ? "✓ 완료" : "진행전",
            organIdx === 3 ? "✓ 완료" : "진행전",
            organIdx === 4 ? "✓ 완료" : "진행전",
            "🔒 잠김", 0, "진행중", "-", "-", "🟢 작전진행중",
            Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss")
          ];
          sheet.appendRow(rowData);
        }

        // 강제 승인 상태 프로퍼티 저장 (학생 기기 감지용)
        const curForce = props.getProperty("FORCE_STAMPS_" + fCls + "_" + gNum) || "[]";
        let arr = [];
        try { arr = JSON.parse(curForce); } catch (e) { }
        if (!arr.includes(organIdx)) arr.push(organIdx);
        props.setProperty("FORCE_STAMPS_" + fCls + "_" + gNum, JSON.stringify(arr));
        props.setProperty("FORCE_TS_" + fCls + "_" + gNum, String(nowTs));
      });

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "forceApprove",
        cls: fCls,
        grp: fGrp,
        organIndex: organIdx,
        ts: nowTs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const rawCls = data.cls || "";
    const clsNum = extractClassNum(rawCls);
    const grp = String(data.grp || "").replace(/[^0-9]/g, "");
    const leader = (data.leader || "").trim();

    // 🔄 4. [모둠 데이터 완전 리셋]
    if (data.action === "resetGroup") {
      const rCls = clsNum;
      const rGrp = String(grp).replace(/[^0-9]/g, "");
      const nowTs = Date.now();
      const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

      // 1) 프로퍼티 완전 삭제
      const startKey = "START_" + rCls + "_" + rGrp;
      props.deleteProperty(startKey);
      props.deleteProperty("FORCE_STAMPS_" + rCls + "_" + rGrp);
      props.deleteProperty("FORCE_TS_" + rCls + "_" + rGrp);
      if (leader) props.deleteProperty("START_LEADER_" + leader.toLowerCase().trim());
      props.setProperty("RESET_" + rCls + "_" + rGrp, String(nowTs));

      // 2) 구글 시트 상의 해당 반 + 모둠 데이터 완벽 초기화 (팀장, 팀원, 스탬프, 시간 등 전부 null/초기값으로 비움)
      const sheet = getOrCreateSheet(ss, SHEET_NAME_STATUS, HEADERS_15);
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        const rowClsNum = extractClassNum(values[i][0]);
        const rowGrp = String(values[i][1] || "").replace(/[^0-9]/g, "");
        if (rowClsNum === rCls && rowGrp === rGrp) {
          const resetRow = [
            rCls,
            rGrp + "모둠",
            "",   // 팀장 이름 완전 비움
            "",   // 팀원 이름 완전 비움
            "진행전", "진행전", "진행전", "진행전",
            "🔒 잠김",
            0,
            "-",
            "-",
            "-",
            "⚪ 대기중",
            nowStr
          ];
          sheet.getRange(i + 1, 1, 1, resetRow.length).setValues([resetRow]);
          sheet.getRange(i + 1, 1, 1, resetRow.length).setBackground("#ffffff");
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "resetGroup",
        cls: rCls,
        grp: rGrp,
        resetTs: nowTs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 🔄 5. [학급 전체 데이터 완전 리셋]
    if (data.action === "resetAll") {
      const rCls = clsNum;
      const nowTs = Date.now();
      const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

      // 1) 프로퍼티 삭제
      const allProps = props.getProperties();
      for (let k in allProps) {
        if (k.startsWith("START_" + rCls + "_") || k.startsWith("RESET_" + rCls + "_") || k.startsWith("FORCE_STAMPS_" + rCls + "_") || k.startsWith("FORCE_TS_" + rCls + "_")) {
          props.deleteProperty(k);
        }
      }
      props.setProperty("RESET_CLASS_" + rCls, String(nowTs));

      // 2) 구글 시트 상의 해당 반 1~6모둠 데이터 완벽 초기화
      const sheet = getOrCreateSheet(ss, SHEET_NAME_STATUS, HEADERS_15);
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        const rowClsNum = extractClassNum(values[i][0]);
        if (rowClsNum === rCls) {
          const rGrp = String(values[i][1] || "").replace(/[^0-9]/g, "");
          const resetRow = [
            rCls,
            (rGrp ? rGrp + "모둠" : values[i][1]),
            "", "",
            "진행전", "진행전", "진행전", "진행전",
            "🔒 잠김",
            0,
            "-",
            "-",
            "-",
            "⚪ 대기중",
            nowStr
          ];
          sheet.getRange(i + 1, 1, 1, resetRow.length).setValues([resetRow]);
          sheet.getRange(i + 1, 1, 1, resetRow.length).setBackground("#ffffff");
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "resetAll",
        cls: rCls,
        resetTs: nowTs
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 📋 6. [일반 학생 작전 상태 전송 / 동기화]
    const sheet = getOrCreateSheet(ss, SHEET_NAME_STATUS, HEADERS_15);
    const members = Array.isArray(data.members) ? data.members.join(", ") : (data.members || "");
    const stamps = data.stamps || [false, false, false, false];
    let s1 = stamps[0] ? "✓ 완료" : "진행중";
    let s2 = stamps[1] ? "✓ 완료" : "진행중";
    let s3 = stamps[2] ? "✓ 완료" : "진행중";
    let s4 = stamps[3] ? "✓ 완료" : "진행중";

    let isFinalCompleted = !!data.finalCompleted;
    let hintCount = Number(data.hintCount || 0);
    const timeDisplay = data.timeDisplay || "";

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

    const startKey = "START_" + clsNum + "_" + grp;
    let startedAt = Number(data.startedAt || 0);
    if (startedAt > 0) {
      props.setProperty(startKey, String(startedAt));
    } else {
      startedAt = Number(props.getProperty(startKey) || 0);
    }

    // 🛡️ [고유 식별 기준 강화: 반 + 모둠 + 팀장 이름 3가지 완전 일치!]
    // 오직 3가지 값이 모두 일치할 때만 동일 세션으로 매칭하여 행 업데이트!
    // 하나라도 다르면 완전히 새로운 행으로 누적 추가!
    const values = sheet.getDataRange().getValues();
    let targetRow = -1;

    if (leader && clsNum && grp) {
      for (let i = values.length - 1; i >= 1; i--) {
        const rowClsNum = extractClassNum(values[i][0]);
        const rowGrp = String(values[i][1] || "").replace(/[^0-9]/g, "");
        const rowLeader = String(values[i][2] || "").trim().toLowerCase();

        const isClassMatch = (rowClsNum === clsNum);
        const isGrpMatch = (rowGrp === grp);
        const isLeaderMatch = (rowLeader === leader.toLowerCase());

        if (isClassMatch && isGrpMatch && isLeaderMatch) {
          targetRow = i + 1;
          break;
        }
      }
    }

    let finalGradeVal = data.grade || (isFinalCompleted ? "완료" : "-");
    let finalTimeDispVal = timeDisplay;

    if (targetRow > 0) {
      const existing = values[targetRow - 1];
      const existingFinal = String(existing[13] || "").includes("완치완료") || String(existing[8] || "").includes("성공");
      const existingClearVal = existing[11];
      const existingGrade = existing[12];
      const existingTimeDisp = existing[10];

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

      if (existing[4] === "✓ 완료") s1 = "✓ 완료";
      if (existing[5] === "✓ 완료") s2 = "✓ 완료";
      if (existing[6] === "✓ 완료") s3 = "✓ 완료";
      if (existing[7] === "✓ 완료") s4 = "✓ 완료";

      hintCount = Math.max(hintCount, Number(existing[9]) || 0);
    }

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
    sheet.getRange(targetRow, 12).setNumberFormat("@");

    if (isFinalCompleted) {
      sheet.getRange(targetRow, 1, 1, rowData.length).setBackground("#ecfdf5");
      const histSheet = getOrCreateSheet(ss, SHEET_NAME_HISTORY, HEADERS_15);
      const histVals = histSheet.getDataRange().getValues();
      let alreadyInHist = false;
      for (let h = 1; h < histVals.length; h++) {
        const hCls = extractClassNum(histVals[h][0]);
        const hGrp = String(histVals[h][1]).replace(/[^0-9]/g, "");
        const hLeader = String(histVals[h][2] || "").trim().toLowerCase();
        if (hCls === clsNum && hGrp === grp && leader && hLeader === leader.toLowerCase()) {
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
    const props = PropertiesService.getScriptProperties();

    // 📢 GET 방식으로도 긴급 공지 전송 지원
    if (e && e.parameter && e.parameter.action === "sendNotice") {
      saveNoticeData(ss, e.parameter.msg, e.parameter.cls, e.parameter.timestamp || e.parameter.ts);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", notice: "broadcasted_via_get" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ⏱ GET 방식으로도 타이머 제어 지원
    if (e && e.parameter && e.parameter.action === "timerCtrl") {
      const targetCls = extractClassNum(e.parameter.cls) || "1";
      const cmd = e.parameter.cmd;
      const ts = Number(e.parameter.timestamp || e.parameter.ts || Date.now());
      if (targetCls === "all") {
        for (let c = 1; c <= 6; c++) updateTimerState(props, String(c), cmd, ts);
      } else {
        updateTimerState(props, targetCls, cmd, ts);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "timerCtrl_via_get",
        timerStates: getAllTimerStates(props)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ⚡ GET 방식으로도 장기 강제 승인 지원
    if (e && e.parameter && e.parameter.action === "forceApprove") {
      const fCls = extractClassNum(e.parameter.cls) || "1";
      const fGrp = String(e.parameter.grp || "").replace(/[^0-9]/g, "");
      const organIdx = Number(e.parameter.organIndex);
      const nowTs = Date.now();
      const sheet = getOrCreateSheet(ss, SHEET_NAME_STATUS, HEADERS_15);
      const values = sheet.getDataRange().getValues();
      const targetGrps = (fGrp && fGrp !== "all") ? [fGrp] : ["1", "2", "3", "4", "5", "6"];

      targetGrps.forEach(gNum => {
        let foundRow = -1;
        for (let i = 1; i < values.length; i++) {
          const rCls = extractClassNum(values[i][0]);
          const rGrp = String(values[i][1] || "").replace(/[^0-9]/g, "");
          if (rCls === fCls && rGrp === gNum) {
            foundRow = i + 1;
            break;
          }
        }
        const organCol = 4 + organIdx;
        if (foundRow > 0) {
          sheet.getRange(foundRow, organCol).setValue("✓ 완료");
          sheet.getRange(foundRow, 15).setValue(Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss"));
        } else {
          const rowData = [
            fCls, gNum + "모둠", "교사 강제승인", "-",
            organIdx === 1 ? "✓ 완료" : "진행전",
            organIdx === 2 ? "✓ 완료" : "진행전",
            organIdx === 3 ? "✓ 완료" : "진행전",
            organIdx === 4 ? "✓ 완료" : "진행전",
            "🔒 잠김", 0, "진행중", "-", "-", "🟢 작전진행중",
            Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss")
          ];
          sheet.appendRow(rowData);
        }
        const curForce = props.getProperty("FORCE_STAMPS_" + fCls + "_" + gNum) || "[]";
        let arr = [];
        try { arr = JSON.parse(curForce); } catch (e) { }
        if (!arr.includes(organIdx)) arr.push(organIdx);
        props.setProperty("FORCE_STAMPS_" + fCls + "_" + gNum, JSON.stringify(arr));
        props.setProperty("FORCE_TS_" + fCls + "_" + gNum, String(nowTs));
      });

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "forceApprove_via_get",
        cls: fCls,
        grp: fGrp,
        organIndex: organIdx
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const noticeData = getNoticeData(ss);
    const sheet = ss.getSheetByName(SHEET_NAME_STATUS);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        notice: noticeData,
        groups: [],
        resets: {},
        timerStates: getAllTimerStates(props),
        forceStamps: {}
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const values = sheet.getDataRange().getValues();
    const filterClsRaw = e && e.parameter && e.parameter.cls ? e.parameter.cls : "";
    const filterClsNum = extractClassNum(filterClsRaw);

    const groupsMap = {};

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row[0] && !row[1] && !row[2]) continue;

      const rClsNum = extractClassNum(row[0]);
      if (filterClsNum && rClsNum !== filterClsNum) continue;

      const rGrp = String(row[1] || "").replace(/[^0-9]/g, "");
      const leaderName = String(row[2] || "").trim();

      // 리셋되어 팀장/팀원이 모두 비어있는 행은 미접속으로 취급
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
      const isCompleted = finalCodeVal.includes("성공") || statusVal.includes("완치완료");

      const startKey = "START_" + rClsNum + "_" + rGrp;
      let startedAt = Number(props.getProperty(startKey) || 0);

      const tDisp = String(row[10] || "");
      if (startedAt === 0 && !isCompleted && tDisp && leaderName) {
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

      const gKey = (rClsNum + "_" + rGrp + "_" + leaderName).toLowerCase();
      if (groupsMap[gKey]) {
        if (!groupsMap[gKey].finalCompleted && isCompleted) {
          groupsMap[gKey] = gInfo;
        }
      } else {
        groupsMap[gKey] = gInfo;
      }
    }

    const groups = Object.values(groupsMap);

    // 🔄 리셋 및 강제승인 정보 수집
    const allProps = props.getProperties();
    const resets = {};
    const forceStamps = {};
    for (let k in allProps) {
      if (k.startsWith("RESET_")) {
        resets[k] = allProps[k];
      }
      if (k.startsWith("FORCE_STAMPS_") || k.startsWith("FORCE_TS_")) {
        forceStamps[k] = allProps[k];
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      notice: noticeData,
      groups: groups,
      resets: resets,
      timerStates: getAllTimerStates(props),
      forceStamps: forceStamps
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function normalizeAllSheetClasses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_STATUS);
  if (!sheet) return;
  autoFixAndAlignSheet(sheet);
}
