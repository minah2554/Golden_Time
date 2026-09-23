/**
 * ============================================================
 * 🏥 골든타임 메디컬 센터 방탈출 - 구글 스프레드시트 실시간 관제 API
 * ============================================================
 * [적용 방법]
 * 1. 구글 스프레드시트(https://docs.google.com/spreadsheets/d/1KNcFWVB6eGS8bGr2avxChuuV3j0YE4kdMG0KrlahZ9E/edit)를 엽니다.
 * 2. 상단 메뉴 [확장 프로그램] > [Apps Script]를 클릭합니다.
 * 3. 기존 코드를 모두 지우고 이 파일의 전체 코드를 붙여넣습니다.
 * 4. 상단 [저장(디스크 아이콘)]을 누릅니다.
 * 5. 우측 상단 파란색 [배포] 버튼 > [배포 관리] 또는 [새 배포]를 클릭합니다.
 *    (기존 배포 편집 시: 버전 [새 버전] 선택 후 배포)
 * 6. 유형: [웹 앱]
 *    - 설명: 골든타임 관제 API (시간/학급 정규화 & 긴급공지 지원)
 *    - 다음 사용자 권한으로 실행: 나 (소유자 이메일)
 *    - 액세스 권한: 모든 사용자 (Anyone)  <-- 중요! (로그인 없이 전송 가능)
 * 7. [배포] 완료!
 */

const SHEET_NAME_STATUS = "골든타임_실시간현황";
const SHEET_NAME_HISTORY = "완치_기록_히스토리";

function extractClassNum(raw) {
  if (!raw) return "";
  const str = String(raw).trim();
  const m = str.match(/([0-9]+)\s*반/);
  if (m) {
    let n = m[1];
    if (n.length === 2 && n.startsWith("2")) n = n.substring(1); // 21반 -> 1반, 24반 -> 4반
    return n;
  }
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

function doPost(e) {
  try {
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter && e.parameter.data) {
      data = JSON.parse(e.parameter.data);
    } else {
      data = e.parameter;
    }

    // 📢 [긴급 공지 브로드캐스트 처리]
    if (data.action === "sendNotice") {
      const props = PropertiesService.getScriptProperties();
      props.setProperty("NOTICE_MSG", data.msg || "");
      props.setProperty("NOTICE_CLS", String(data.cls || "all"));
      props.setProperty("NOTICE_TIME", String(data.timestamp || Date.now()));
      return ContentService.createTextOutput(JSON.stringify({ status: "success", notice: "broadcasted" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const headers = [
      "학급", "모둠", "수석 명의(팀장)", "전문의팀(팀원)",
      "차트01(소화)", "차트02(순환)", "차트03(호흡)", "차트04(신장)",
      "힌트 사용(회)", "현재 진행/남은시간", "완치 소요시간",
      "최종 등급", "진행 상태", "최근 업데이트"
    ];
    const sheet = getOrCreateSheet(ss, SHEET_NAME_STATUS, headers);

    const rawCls = data.cls || "";
    const clsNum = extractClassNum(rawCls);
    const grp = String(data.grp || "").replace(/[^0-9]/g, "");
    const leader = data.leader || "";
    const members = Array.isArray(data.members) ? data.members.join(", ") : (data.members || "");
    const stamps = data.stamps || [false, false, false, false];
    const s1 = stamps[0] ? "✓ 완료" : "진행중";
    const s2 = stamps[1] ? "✓ 완료" : "진행중";
    const s3 = stamps[2] ? "✓ 완료" : "진행중";
    const s4 = stamps[3] ? "✓ 완료" : "진행중";
    const hintCount = Number(data.hintCount || 0);
    const timeDisplay = data.timeDisplay || "";
    
    // 텍스트 강제 처리 (' 접두어로 구글 시트가 1899 날짜로 자동 변환하지 못하도록 방지)
    let clearTimeStr = data.clearTimeStr || (data.finalCompleted ? timeDisplay : "");
    if (clearTimeStr && clearTimeStr !== "-") {
      clearTimeStr = "'" + String(clearTimeStr).replace(/^'/, "");
    } else {
      clearTimeStr = "-";
    }

    const grade = data.grade || (data.finalCompleted ? "완료" : "-");
    const status = data.finalCompleted ? "🏆 완치완료" : "🟢 작전진행중";
    const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

    const formattedCls = clsNum ? ("2학년 " + clsNum + "반") : (rawCls || "2학년");
    const formattedGrp = grp ? (grp + "모둠") : "-";

    const rowData = [
      formattedCls,
      formattedGrp,
      leader,
      members,
      s1, s2, s3, s4,
      hintCount,
      timeDisplay,
      clearTimeStr,
      grade,
      status,
      nowStr
    ];

    // 기존 해당 학급+모둠 행 탐색 및 갱신 (없으면 추가)
    const values = sheet.getDataRange().getValues();
    let targetRow = -1;

    for (let i = 1; i < values.length; i++) {
      const rowClsNum = extractClassNum(values[i][0]);
      const rowGrpNum = String(values[i][1]).replace(/[^0-9]/g, "");
      if (rowClsNum === clsNum && rowGrpNum === grp) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
      targetRow = sheet.getLastRow();
    }

    // 스타일 강조
    if (data.finalCompleted) {
      sheet.getRange(targetRow, 1, 1, rowData.length).setBackground("#ecfdf5");
      const histSheet = getOrCreateSheet(ss, SHEET_NAME_HISTORY, headers);
      histSheet.appendRow(rowData);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", row: targetRow }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 📢 긴급 공지 조회
    const props = PropertiesService.getScriptProperties();
    const noticeMsg = props.getProperty("NOTICE_MSG") || "";
    const noticeCls = props.getProperty("NOTICE_CLS") || "all";
    const noticeTime = Number(props.getProperty("NOTICE_TIME") || 0);

    const sheet = ss.getSheetByName(SHEET_NAME_STATUS);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        notice: { msg: noticeMsg, cls: noticeCls, ts: noticeTime },
        groups: []
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const values = sheet.getDataRange().getValues();
    const filterClsRaw = e && e.parameter && e.parameter.cls ? e.parameter.cls : "";
    const filterClsNum = extractClassNum(filterClsRaw);

    const groups = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rClsNum = extractClassNum(row[0]);
      if (filterClsNum && rClsNum !== filterClsNum) continue;

      const rGrp = String(row[1] || "").replace(/[^0-9]/g, "");

      // 날짜 변환 방지: Date 객체인 경우 시간 문자열로 추출
      let clearVal = row[10];
      if (clearVal instanceof Date) {
        const mm = clearVal.getMinutes();
        const ssSec = clearVal.getSeconds();
        clearVal = String(mm).padStart(2, '0') + ':' + String(ssSec).padStart(2, '0');
      } else {
        clearVal = String(clearVal || "").replace(/^'/, "");
      }

      groups.push({
        cls: row[0],
        clsNum: rClsNum,
        grp: Number(rGrp) || row[1],
        leader: row[2],
        members: row[3],
        stamps: [row[4] === "✓ 완료", row[5] === "✓ 완료", row[6] === "✓ 완료", row[7] === "✓ 완료"],
        hintCount: Number(row[8]) || 0,
        timeDisplay: String(row[9] || ""),
        clearTimeStr: clearVal !== "-" ? clearVal : null,
        grade: row[11],
        finalCompleted: String(row[12]).includes("완치완료"),
        updatedAt: row[13] instanceof Date ? Utilities.formatDate(row[13], "Asia/Seoul", "yyyy-MM-dd HH:mm:ss") : row[13]
      });
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      notice: { msg: noticeMsg, cls: noticeCls, ts: noticeTime },
      groups: groups
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
