/**
 * ============================================================
 * 🏥 골든타임 메디컬 센터 방탈출 - 구글 스프레드시트 실시간 관제 API
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
 * [기존 데이터 반 번호 일괄 정리 팁]
 * Apps Script 상단 함수 선택 드롭다운에서 'normalizeAllSheetClasses'를 선택 후
 * [실행] 버튼을 누르면 기존 시트의 '21반', '24반' 등이 '1', '4'로 자동 정리됩니다.
 */

const SHEET_NAME_STATUS = "골든타임_실시간현황";
const SHEET_NAME_HISTORY = "완치_기록_히스토리";

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

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#0f172a");
    headerRange.setFontColor("#38bdf8");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  }
  return sheet;
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
  } catch (e) {}

  try {
    const sheet = ss.getSheetByName(SHEET_NAME_STATUS);
    if (sheet) {
      sheet.getRange("Z1").setValue(JSON.stringify({ msg: m, cls: c, ts: ts }));
    }
  } catch (e) {}
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
  } catch (e) {}

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
    } catch (e) {}
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

    const headers = [
      "학급", "모둠", "수석 명의(팀장)", "전문의팀(팀원)",
      "차트01(소화)", "차트02(순환)", "차트03(호흡)", "차트04(신장)",
      "최종 미션코드",
      "힌트 사용(회)", "현재 진행/남은시간", "완치 소요시간",
      "최종 등급", "진행 상태", "최근 업데이트"
    ];
    const sheet = getOrCreateSheet(ss, SHEET_NAME_STATUS, headers);

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

    let isFinalCompleted = !!data.finalCompleted;
    let hintCount = Number(data.hintCount || 0);
    const timeDisplay = data.timeDisplay || "";

    // 텍스트 강제 처리 (' 접두어로 구글 시트가 1899 날짜로 자동 변환하지 못하도록 방지)
    let clearTimeStr = data.clearTimeStr || (isFinalCompleted ? timeDisplay : "");
    if (clearTimeStr && clearTimeStr !== "-") {
      clearTimeStr = "'" + String(clearTimeStr).replace(/^'/, "");
    } else {
      clearTimeStr = "-";
    }

    // 기존 해당 학급+모둠 또는 학급+팀장 행 탐색
    const values = sheet.getDataRange().getValues();
    let targetRow = -1;
    const headerRow = values[0];
    const hasFinalHeader = String(headerRow[8] || "").includes("코드");

    for (let i = 1; i < values.length; i++) {
      const rowClsNum = extractClassNum(values[i][0]);
      const rowGrpNum = String(values[i][1]).replace(/[^0-9]/g, "");
      const rowLeader = String(values[i][2] || "").trim();

      // 학급 일치 && (모둠 일치 또는 팀장 이름 일치)
      if (rowClsNum === clsNum && (rowGrpNum === grp || (leader && rowLeader === leader))) {
        targetRow = i + 1;
        break;
      }
    }

    // 🛡️ [데이터 보호 로직: 타 기기 재접속 시 진행 상황 손실 방지]
    if (targetRow > 0) {
      const existing = values[targetRow - 1];
      const statusIdx = hasFinalHeader ? 13 : 12;
      const clearTimeIdx = hasFinalHeader ? 11 : 10;
      const existingFinal = String(existing[statusIdx] || "").includes("완치완료");
      const existingClearVal = existing[clearTimeIdx];

      if (data.action !== "resetGroup") {
        // 1. 이미 완치 완료된 경우 미완료로 다운그레이드 방지
        if (existingFinal && !isFinalCompleted) {
          isFinalCompleted = true;
          if (existingClearVal && existingClearVal !== "-") {
            clearTimeStr = "'" + String(existingClearVal).replace(/^'/, "");
          }
        }

        // 2. 이미 완료된 스탬프는 유지 (새 기기에서 빈 스탬프로 덮어쓰기 방지)
        const e1 = existing[4] === "✓ 완료";
        const e2 = existing[5] === "✓ 완료";
        const e3 = existing[6] === "✓ 완료";
        const e4 = existing[7] === "✓ 완료";
        if (e1) s1 = "✓ 완료";
        if (e2) s2 = "✓ 완료";
        if (e3) s3 = "✓ 완료";
        if (e4) s4 = "✓ 완료";

        const hintIdx = hasFinalHeader ? 9 : 8;
        hintCount = Math.max(hintCount, Number(existing[hintIdx]) || 0);
      }
    }

    // 최종 코드 상태 산출 (4개 스탬프 완료 + 최종 코드 성공 시 완치 완료)
    const allStamps = (s1 === "✓ 완료" && s2 === "✓ 완료" && s3 === "✓ 완료" && s4 === "✓ 완료");
    const finalCodeCol = isFinalCompleted ? "✓ 성공" : (allStamps ? "🔓 해제됨(진행중)" : "🔒 잠김");

    const grade = data.grade || (isFinalCompleted ? "완료" : "-");
    const status = isFinalCompleted ? "🏆 완치완료" : (allStamps ? "🔓 최종코드입력중" : "🟢 작전진행중");
    const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

    // 학급 번호: 사용자가 요청한 '1' (순수 반 번호)로 명확히 기록
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
      timeDisplay,
      clearTimeStr,
      grade,
      status,
      nowStr
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
      targetRow = sheet.getLastRow();
    }

    // 스타일 강조
    if (isFinalCompleted) {
      sheet.getRange(targetRow, 1, 1, rowData.length).setBackground("#ecfdf5");
      const histSheet = getOrCreateSheet(ss, SHEET_NAME_HISTORY, headers);
      histSheet.appendRow(rowData);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      row: targetRow,
      stamps: [s1 === "✓ 완료", s2 === "✓ 완료", s3 === "✓ 완료", s4 === "✓ 완료"],
      finalCompleted: isFinalCompleted,
      hintCount: hintCount
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 📢 GET 방식으로도 긴급 공지 전송 지원 (CORS 없이 안전 전송)
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

    const headerRow = values[0] || [];
    const hasFinalHeader = String(headerRow[8] || "").includes("코드");
    const offset = hasFinalHeader ? 1 : 0;

    const groups = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rClsNum = extractClassNum(row[0]);
      if (filterClsNum && rClsNum !== filterClsNum) continue;

      const rGrp = String(row[1] || "").replace(/[^0-9]/g, "");

      const clearTimeIdx = 10 + offset;
      let clearVal = row[clearTimeIdx];
      if (clearVal instanceof Date) {
        const mm = clearVal.getMinutes();
        const ssSec = clearVal.getSeconds();
        clearVal = String(mm).padStart(2, '0') + ':' + String(ssSec).padStart(2, '0');
      } else {
        clearVal = String(clearVal || "").replace(/^'/, "");
      }

      const finalCodeVal = hasFinalHeader ? String(row[8] || "") : "";
      const statusVal = String(row[12 + offset] || "");
      const isCompleted = finalCodeVal.includes("성공") || statusVal.includes("완치완료");

      groups.push({
        cls: row[0],
        clsNum: rClsNum,
        grp: Number(rGrp) || row[1],
        leader: row[2],
        members: row[3],
        stamps: [row[4] === "✓ 완료", row[5] === "✓ 완료", row[6] === "✓ 완료", row[7] === "✓ 완료"],
        finalCode: finalCodeVal,
        hintCount: Number(row[8 + offset]) || 0,
        timeDisplay: String(row[9 + offset] || ""),
        clearTimeStr: (clearVal !== "-" && isCompleted) ? clearVal : null,
        grade: row[11 + offset],
        finalCompleted: isCompleted,
        updatedAt: row[13 + offset] instanceof Date ? Utilities.formatDate(row[13 + offset], "Asia/Seoul", "yyyy-MM-dd HH:mm:ss") : row[13 + offset]
      });
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      notice: noticeData,
      groups: groups
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 🛠️ [선택 실행] 구글 시트 기존 학급 열 정규화 함수
 * 구글 시트 Apps Script 에디터에서 이 함수를 선택하고 [실행]을 누르면,
 * 기존에 '21반', '24반' 등으로 기록된 데이터를 모두 '1', '4' 등 순수 반 번호로 자동 일괄 정리합니다.
 */
function normalizeAllSheetClasses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME_STATUS);
  if (!sheet) return;
  const range = sheet.getDataRange();
  const values = range.getValues();
  for (let i = 1; i < values.length; i++) {
    const rawCls = values[i][0];
    const n = extractClassNum(rawCls);
    if (n) {
      sheet.getRange(i + 1, 1).setValue(n);
    }
  }
}
