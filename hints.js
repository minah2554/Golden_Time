/**
 * ============================================================================
 * 🏥 [메디컬 센터 골든타임 35분] - 힌트 설정 스크립트 (선생님 전용 수정 파일)
 * ============================================================================
 * 
 * 📌 안내:
 * - 이 파일의 내용을 수정하면 방탈출 웹앱의 각 단계 힌트가 즉시 변경됩니다.
 * - 제목(title)과 힌트 문장(lines)을 자유롭게 변경하거나 추가/삭제할 수 있습니다.
 * - HTML 태그(<span class="...">, <b> 등)를 사용하여 글자 색상과 강조를 적용할 수 있습니다.
 * 
 * 🎨 추천 색상 클래스:
 * - text-amber-400 : 노란색/주황색 강조
 * - text-cyan-400  : 하늘색 강조
 * - text-green-400 : 초록색 강조
 * - text-red-400   : 빨간색 강조
 * - font-bold      : 굵은 글씨
 * ============================================================================
 */

window.GAME_HINTS = {
  // --------------------------------------------------------------------------
  // [CHART 01] 소화기내과 - 펩신 / VPQTLS
  // --------------------------------------------------------------------------
  chart1: {
    organName: "소화기내과 (위·소장·대장 소화관)",
    step1: {
      title: "💡 1단계 힌트: 소화효소란?",
      lines: [
        "• <span class=\"text-amber-400 font-bold\">위</span>에서 분비되는 대표 단백질 소화효소: <span class=\"text-yellow-400 font-bold\">펩신(pepsin)</span>",
        "• 펩신은 음식물 속 <span class=\"text-cyan-400 font-bold\">단백질</span>을 더 작은 단위로 분해하는 소화효소입니다.",
        "• 위액 속 <span class=\"text-red-400 font-bold\">염산(pH 1~2의 강산)</span>에 의해 활성화되어 살균과 소화를 돕습니다."
      ]
    },
    step2: {
      title: "💡 2단계 힌트: 미로 풀이법",
      lines: [
        "• 미로의 각 분기점에서 막힌 길이 아닌 <span class=\"text-cyan-400 font-bold\">✓ 통과 경로</span>의 알파벳만 순서대로 추출하세요!",
        "• 분기점 순서: J1(V) → J2(P) → J3(Q) → J4(T) → J5(L) → J6(S)",
        "• 조합 결과: <span class=\"text-green-400 font-bold orb text-base\">VPQTLS</span> = 펩신의 치료 암호 코드",
        "• ⚠️ 영문 <span class=\"text-green-400 font-bold\">VPQTLS</span> 또는 한글 <span class=\"text-green-400 font-bold\">펩신</span> 중 어느 것을 입력해도 정답 처리됩니다."
      ]
    }
  },

  // --------------------------------------------------------------------------
  // [CHART 02] 순환기내과 - 4129
  // --------------------------------------------------------------------------
  chart2: {
    organName: "순환기내과 (심장 및 혈관 순환)",
    step1: {
      title: "💡 1단계 힌트: 혈액 순환 경로",
      lines: [
        "• <span class=\"text-red-400 font-bold\">온몸 순환(체순환)</span>: 좌심실 → 대동맥 → 온몸의 모세혈관 → 대정맥 → 우심방",
        "• <span class=\"text-cyan-400 font-bold\">허파 순환(폐순환)</span>: 우심실 → 폐동맥 → 폐의 모세혈관 → 폐정맥 → 좌심방",
        "• 심장은 산소가 풍부한 동맥혈과 이산화탄소가 많은 정맥혈을 분리 펌핑하는 이중 순환 구조입니다."
      ]
    },
    step2: {
      title: "💡 2단계 힌트: 코드 조합법",
      lines: [
        "• [온몸 순환] 홀수 수치 합산: 17 + 3 + 11 + 7 + 3 = <span class=\"text-amber-400 font-bold orb text-base\">41</span>",
        "• [허파 순환] 누적 측정값: 8 + 6 + 11 + 4 = <span class=\"text-cyan-400 font-bold orb text-base\">29</span>",
        "• 두 숫자를 순서대로 이어 붙이면: <span class=\"text-green-400 font-bold orb text-lg\">4129</span>"
      ]
    }
  },

  // --------------------------------------------------------------------------
  // [CHART 03] 호흡기내과 - 8522
  // --------------------------------------------------------------------------
  chart3: {
    organName: "호흡기내과 (폐 및 기체 교환)",
    step1: {
      title: "💡 1단계 힌트: 폐포 기체 교환 원리",
      lines: [
        "• <span class=\"text-cyan-400 font-bold\">기체 교환의 원리 = 확산</span>: 기체 분자는 농도(분압)가 높은 곳에서 낮은 곳으로 이동합니다.",
        "• <span class=\"text-green-400 font-bold\">산소(O₂)</span>: 폐포(농도 높음) → 모세혈관 혈액(농도 낮음)으로 이동",
        "• <span class=\"text-amber-400 font-bold\">이산화탄소(CO₂)</span>: 모세혈관 혈액(농도 높음) → 폐포(농도 낮음)로 이동 후 날숨으로 배출"
      ]
    },
    step2: {
      title: "💡 2단계 힌트: 코드 추출법",
      lines: [
        "• 호흡 파형 펄스 카운트: '확' = <span class=\"text-cyan-400 font-bold\">8회</span>, '산' = <span class=\"text-amber-400 font-bold\">5회</span>",
        "• 기체 분자식의 아래첨자: 산소(O<span class=\"text-cyan-400 font-bold\">₂</span>) → <span class=\"text-cyan-400 font-bold\">2</span>, 이산화탄소(CO<span class=\"text-amber-400 font-bold\">₂</span>) → <span class=\"text-amber-400 font-bold\">2</span>",
        "• 4개 숫자를 순서대로 조합: <span class=\"text-green-400 font-bold orb text-lg\">8 5 2 2</span>"
      ]
    }
  },

  // --------------------------------------------------------------------------
  // [CHART 04] 신장내과 - 3709
  // --------------------------------------------------------------------------
  chart4: {
    organName: "신장내과 (콩팥 및 노폐물 배설)",
    step1: {
      title: "💡 1단계 힌트: 콩팥(신장)의 오줌 형성 과정",
      lines: [
        "• <span class=\"text-cyan-400 font-bold\">1단계 [여과]</span>: 사구체에서 보먼주머니로 크기가 작은 물질(물, 포도당, 아미노산, 요소, 무기염류)이 이동 (단백질, 혈구는 여과 X)",
        "• <span class=\"text-amber-400 font-bold\">2단계 [재흡수]</span>: 세뇨관을 지나며 포도당·아미노산은 100% 재흡수, 물과 무기염류는 필요한 만큼 재흡수",
        "• <span class=\"text-purple-400 font-bold\">3단계 [분비 및 배설]</span>: 혈액 속 남은 노폐물을 모아 최종 오줌(요소, 물, 잉여 무기염류)으로 방광 배출"
      ]
    },
    step2: {
      title: "💡 2단계 힌트: 코드 추출법",
      lines: [
        "• 건강한 사람의 최종 오줌에 정상적으로 배출되는 물질을 차트에서 찾으세요.",
        "• 정상 배출 성분: <span class=\"text-amber-400 font-bold\">요소</span>(물질코드 <span class=\"text-white font-bold\">37</span>) + <span class=\"text-cyan-400 font-bold\">물</span>(물질코드 <span class=\"text-white font-bold\">09</span>)",
        "• (주의: 포도당이나 단백질이 오줌에 섞여 나오면 당뇨나 신장 질환입니다!)",
        "• 두 코드를 이어 붙이면: <span class=\"text-green-400 font-bold orb text-lg\">3709</span>"
      ]
    }
  },

  // --------------------------------------------------------------------------
  // [FINAL] 최종 마스터 치료 코드 (교실 벽면 포스터 힌트)
  // --------------------------------------------------------------------------
  final: {
    organName: "최종 통합 치료 (중앙 제어 시스템)",
    title: "💡 최종 단계 힌트: 벽면 포스터의 보안 번호",
    lines: [
      "• 4대 장기 스탬프를 모두 획득하면 중앙 제어 주입기가 개방됩니다.",
      "• 교실 동서남북 사방 벽면에 부착된 <span class=\"text-amber-400 font-bold\">4장의 장기별 포스터</span> 하단 보안번호를 확인하세요.",
      "• 입력 순서: <span class=\"text-cyan-400 font-bold\">①소화기 → ②순환기 → ③호흡기 → ④신장내과</span>",
      "• 각 포스터의 대표 숫자를 순서대로 조합하면 <span class=\"text-red-400 font-bold orb\">4자리 최종 마스터 암호(3817)</span>가 완성됩니다!"
    ]
  }
};
