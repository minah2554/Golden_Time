/**
 * ============================================================
 * 🏥 골든타임 메디컬 센터 방탈출 - 구글 스프레드시트 실시간 관제 API
 * ============================================================
 * [적용 방법]
 * 1. 구글 스프레드시트(https://docs.google.com/spreadsheets/d/1KNcFWVB6eGS8bGr2avxChuuV3j0YE4kdMG0KrlahZ9E/edit)를 엽니다.
 * 2. 상단 메뉴 [확장 프로그램] > [Apps Script]를 클릭합니다.
 * 3. 기존 코드를 모두 지우고 이 파일의 전체 코드를 붙여넣습니다.
 * 4. 상단 [저장(디스크 아이콘)]을 누릅니다.
 * 5. 우측 상단 파란색 [배포] 버튼 > [새 배포]를 클릭합니다.
 * 6. 유형 선택: [웹 앱] (톱니바퀴 아이콘)
 *    - 설명: 골든타임 관제 API
 *    - 다음 사용자 권한으로 실행: 나 (소유자 이메일)
 *    - 액세스 권한: 모든 사용자 (Anyone)  <-- 중요! (로그인 없이 전송 가능)
 * 7. [배포] 클릭 후 승인 절차를 진행합니다.
 * 8. 생성된 [웹 앱 URL]:
 *    https://script.google.com/macros/s/AKfycbxvxvzZ3kFKz4mAfHlL8jFYrrvCvvw8JoKaO0CU89_-JTxXNnSKc6i5-ivG8M72DrqB/exec
 *    (웹앱 기본 연동 주소로 자동 등록 완료)
 */

const SHEET_NAME_STATUS = "골든타임_실시간현황";
const SHEET_NAME_HISTORY = "완치_기록_히스토리";

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

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const headers = [
      "학급", "모둠", "수석 명의(팀장)", "전문의팀(팀원)",
      "차트01(소화)", "차트02(순환)", "차트03(호흡)", "차트04(신장)",
      "힌트 사용(회)", "현재 진행/남은시간", "완치 소요시간",
      "최종 등급", "진행 상태", "최근 업데이트"
    ];
    const sheet = getOrCreateSheet(ss, SHEET_NAME_STATUS, headers);

    const cls = String(data.cls || "").replace(/[^0-9]/g, "");
    const grp = String(data.grp || "");
    const leader = data.leader || "";
    const members = Array.isArray(data.members) ? data.members.join(", ") : (data.members || "");
    const stamps = data.stamps || [false, false, false, false];
    const s1 = stamps[0] ? "✓ 완료" : "진행중";
    const s2 = stamps[1] ? "✓ 완료" : "진행중";
    const s3 = stamps[2] ? "✓ 완료" : "진행중";
    const s4 = stamps[3] ? "✓ 완료" : "진행중";
    const hintCount = Number(data.hintCount || 0);
    const timeDisplay = data.timeDisplay || "";
    const clearTimeStr = data.clearTimeStr || (data.finalCompleted ? timeDisplay : "");
    const grade = data.grade || (data.finalCompleted ? "완료" : "-");
    const status = data.finalCompleted ? "🏆 완치완료" : "🟢 작전진행중";
    const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

    const rowData = [
      cls ? (cls + "반") : "전체",
      grp ? (grp + "모둠") : "-",
      leader,
      members,
      s1, s2, s3, s4,
      hintCount,
      timeDisplay,
      clearTimeStr || "-",
      grade,
      status,
      nowStr
    ];

    // 기존 해당 학급+모둠 행 탐색 및 갱신 (없으면 추가)
    const values = sheet.getDataRange().getValues();
    let targetRow = -1;
    const targetCls = cls ? (cls + "반") : "";
    const targetGrp = grp ? (grp + "모둠") : "";

    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === targetCls && values[i][1] === targetGrp) {
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
      // 완치 히스토리에도 영구 보존용으로 한 줄 추가
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
    const sheet = ss.getSheetByName(SHEET_NAME_STATUS);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", groups: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const values = sheet.getDataRange().getValues();
    const filterCls = e && e.parameter && e.parameter.cls ? String(e.parameter.cls).replace(/[^0-9]/g, "") : "";

    const groups = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rCls = String(row[0] || "").replace(/[^0-9]/g, "");
      if (filterCls && rCls !== filterCls) continue;

      const rGrp = String(row[1] || "").replace(/[^0-9]/g, "");
      groups.push({
        cls: row[0],
        grp: Number(rGrp) || row[1],
        leader: row[2],
        members: row[3],
        stamps: [row[4] === "✓ 완료", row[5] === "✓ 완료", row[6] === "✓ 완료", row[7] === "✓ 완료"],
        hintCount: Number(row[8]) || 0,
        timeDisplay: row[9],
        clearTimeStr: row[10] !== "-" ? row[10] : null,
        grade: row[11],
        finalCompleted: String(row[12]).includes("완치완료"),
        updatedAt: row[13]
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", groups: groups }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
