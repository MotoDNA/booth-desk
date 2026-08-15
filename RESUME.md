# BOOTH DESK B2B Ver 3.0 — 재개 문서

이 파일부터 읽으면 됩니다. Ver 2.0 제품 규칙은 `CLAUDE.md`에 따로 있습니다.

## 지금 어디까지 왔나

명세서(사용자 제공 "BOOTH DESK B2B Ver 3.0 통합 개발 명세서") 기준 **STEP 1~7 + GAS 완료.**
다음은 **STEP 8 (AI 이메일 초안).**

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 코드 분석 | ✅ |
| 2 | B2B 데이터 계층 (9개 저장소, 마이그레이션, 동기화 큐) | ✅ |
| 3 | 전시회(Event) 관리 | ✅ |
| 4 | 리드·회사 화면, 상담 이력 타임라인 | ✅ |
| 5 | 대시보드 | ✅ |
| 6 | 후속 연락(Follow-up) 센터 | ✅ |
| 9 | Google Apps Script 백엔드 (순서 앞당김) | ✅ 배포·검증 완료 |
| 7 | AI 리드 분석 | ✅ 실제 Claude로 검증 완료 |
| **8** | **AI 이메일 초안** | ← 다음 |
| 10~15 | 회사 인텔리전스 / 파이프라인 / 분석 / 팀 / 보안 / 회귀 | 미착수 |

## 파일

```
~/booth-desk/                    (MotoDNA/booth-desk · 비공개)
├── index.html                   Ver 2.0. 판매 중인 제품. 동결 — 버그 수정만.
├── booth-desk-b2b.html          Ver 3.0. 작업 대상.
├── CLAUDE.md                    Ver 2.0 제품 규칙 (사용자 작성)
├── RESUME.md                    이 파일
├── gs/                          Apps Script 서버
│   ├── ALL_IN_ONE.gs            배포용 합본 (7개 파일을 이어붙인 것)
│   ├── ALL_IN_ONE.html/.txt     브라우저 복사용 (생성물)
│   ├── Config/Utils/SheetService/SyncService/AIService/ApiRouter/Code.gs
│   ├── test.js                  스텁 환경 테스트 37개
│   └── README.md                설치 안내서 (비개발자용)
└── tool/mock_gas.py             모의 GAS 서버 (포트 8793)
```

## 절대 하지 말 것

1. **`index.html`을 Ver 3.0 작업으로 건드리지 않는다.** 판매 중인 제품이다.
2. **`MotoDNA/booth-scan`을 건드리지 않는다.** ACTIVA 전용, K-PRINT 현장용.
3. **저장소 이름을 바꾸지 않는다.** IndexedDB와 localStorage는 폴더가 아니라 **origin 단위**로 공유된다. GitHub Pages에서 `booth-desk`와 `booth-scan`은 같은 origin이므로 이름이 겹치면 현장 데이터가 덮어써진다.

```
boothdesk            Ver 2.0 (읽기만)
kprint2026           booth-scan (손대지 않음)
boothDeskB2B         Ver 3.0 데이터
boothDeskB2B-v2ui    Ver 3.0 안의 옛 화면용 (전환기)
bdb2b-cfg            Ver 3.0 설정
```

`booth-desk-b2b.html`의 `B2B.NS` 위에 충돌 검사 가드가 있다. 이름이 겹치면 앱이 로드 시점에 throw한다.

## 확정된 설계 결정 (사용자 승인)

- **별도 파일로 개발.** Ver 2.0은 동결, Ver 3.0은 `booth-desk-b2b.html`.
- **GAS는 고객사 자기 구글 계정에 설치.** 우리 서버 없음 → 개인정보 보관 책임 없음 + API 키가 브라우저에서 사라짐. `CLAUDE.md`의 "중앙 서버 금지"와 명세서 49번을 동시에 만족하는 유일한 구조.
- **로그인 대신 라이선스 키.** 서명된 키를 오프라인 검증, 무료 체험 30건 제한 포함. 이유: 우리 서버가 없으니 승인할 곳이 없고, 전시장에서 로그인은 접수를 막을 수 있고, 파일을 통째로 주는 구조라 로그인이 지키는 게 없다. 아직 미구현.
- **팀 기능은 로그인 없이** 기기별 역할 구분만.
- **AI는 결정하지 않는다.** AI 등급은 `aiGrade`로 담당자 등급과 따로 저장하고 화면에 둘 다 보여준다. 사용자가 버튼을 눌러야 바뀐다. 사용자가 직접 연기한 후속 날짜는 AI가 덮지 않는다(`followups.adjusted`).

## 서버 (배포 완료)

- URL: `https://script.google.com/macros/s/AKfycby-IlIvNqrjF2-z3oRzqcMnERAvmHje5eV_ZIJRcJeKpMampNeONfOMm-BnMO_F3889qg/exec`
- 스크립트 속성: `SHARED_TOKEN`, `ANTHROPIC_API_KEY` (**둘 다 사용자만 안다. 요청하지 말 것.**)
- 시트: `BOOTH_DESK_DB` (Events/Leads/Companies/Interactions/FollowUps/EmailLogs/SyncLogs)
- **코드 수정 후 반드시 재배포:** 배포 ▾ → 배포 관리 → ✏️ 연필 → 버전 **새 버전** → 배포.
  "새 배포"를 쓰면 URL이 바뀌어 앱 설정을 다시 고쳐야 한다.
- 상태 확인(토큰 불필요): `curl -sL "<URL>"`

## 실물에서만 드러난 함정

- **Claude Sonnet 5는 `temperature`를 거부한다** (기본값 아닌 값 → 400). `top_p`/`top_k`도 같다.
- **Sonnet 5는 thinking이 기본으로 켜져 있고** `max_tokens`가 *생각+답변*을 합쳐 제한한다. 예산이 작으면 JSON이 잘리고, 증상은 엉뚱하게 `"no JSON in model reply"`로 나온다. 그래서 AI 호출에 `thinking: {type:'disabled'}`를 넣었다 (`Config.gs`).
- **모의 서버는 이 둘을 다 받아준다.** AI 관련 변경은 실제 배포에서 확인해야 한다.
- Safari에서 코드를 복사할 때 **잘리거나 한글이 깨진다.** `ALL_IN_ONE.html`(UTF-8 명시)을 브라우저로 열어 ⌘A·⌘C 하는 경로가 유일하게 안정적이다. `pbcopy`는 이 환경에서 막혀 있다.
- 미리보기 창(Claude Browser) 스크린샷이 자주 빈 화면으로 나온다. DOM을 `javascript_tool`로 읽는 편이 확실하다.

## 개발 환경 되살리기

```bash
# 로컬 서버 (미리보기 + 코드 복사용) — .claude/launch.json 의 booth-desk 항목
# preview_start({name:"booth-desk"}) 로 띄운다. 포트 8792, 루트는 ~/booth-desk
#   http://localhost:8792/booth-desk-b2b.html
#   http://localhost:8792/gs/ALL_IN_ONE.html   ← 서버 코드 복사용

# 서버 로직 테스트 (구글 없이)
cd ~/booth-desk/gs && node test.js
cd ~/booth-desk/gs && ALLINONE=1 node test.js

# 합본 재생성 (7개 파일 수정 후 반드시)
# RESUME.md 아래 "합본 재생성" 스니펫 참고

# 모의 GAS 서버 (오프라인 개발용, 포트 8793, 토큰 test-token)
python3 ~/booth-desk/tool/mock_gas.py
```

### 합본 재생성

`gs/*.gs`를 고치면 `ALL_IN_ONE.gs`와 `ALL_IN_ONE.html/.txt`를 다시 만들어야 한다.

```bash
cd ~/booth-desk/gs && python3 - <<'PY'
import io, html
order = ['Config.gs','Utils.gs','SheetService.gs','SyncService.gs','AIService.gs','ApiRouter.gs','Code.gs']
head = io.open('ALL_IN_ONE.gs', encoding='utf-8').read().split('/* ═══════════ Config.gs')[0]
parts = [head]
for f in order:
    parts.append('/* ═══════════ ' + f + ' ═══════════ */\n')
    parts.append(io.open(f, encoding='utf-8').read().rstrip() + '\n\n')
code = ''.join(parts)
io.open('ALL_IN_ONE.gs','w',encoding='utf-8').write(code)
io.open('ALL_IN_ONE.txt','w',encoding='utf-8').write(code)
esc = code.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
io.open('ALL_IN_ONE.html','w',encoding='utf-8').write(
 '<!doctype html><html><head><meta charset="utf-8"><title>ALL_IN_ONE.gs</title>'
 '<style>body{margin:0}pre{margin:0;font:13px/1.5 ui-monospace,Menlo,monospace;white-space:pre}</style>'
 '</head><body><pre>' + esc + '</pre></body></html>')
print('regenerated', code.count(chr(10)) + 1, 'lines')
PY
```

## 다음 단계: STEP 8 — AI 이메일 초안

명세서 31~35번. 요약하면:

- 서버에 `generateEmail` 액션 추가 (`AIService.gs`). 프롬프트는 **서버에** 둔다 — 앱이 프롬프트를 못 보내게 하는 게 현재 구조의 보안 전제다.
- 입력: 회사·리드 프로필, 전시회, 상담 요약, 관심/요청, 이전 상담 이력, 자사 정보, 서명. **개인정보 최소화 원칙 유지** (지금 `aiLeadInput`이 이름·전화·이메일을 안 보낸다 — 이메일 생성은 수신자 이름이 필요하니 그 부분만 예외로 하고 이유를 남길 것).
- 출력: `{subject, body, summary, recommendedAction, recommendedFollowupDays}` — plain text, HTML 아님.
- **명세서 32번이 이 단계의 핵심.** 상담 안 한 내용 지어내기 금지, 가격·제품명 임의 생성 금지, 고객이 요청 안 한 약속 금지.
- 화면: 이메일 미리보기 + [수정] [다시 생성] [취소] [승인 후 발송]. **자동 발송 절대 금지** (명세서 33번). 발송 자체는 STEP 9(Gmail)이므로, 이번 단계는 **초안 생성과 미리보기·수정까지**.
- 중복 발송 방지(명세서 64번)는 발송 붙일 때 같이.

## 작업 방식 (사용자 요청)

- 각 단계 후 **실제 브라우저에서 확인**하고 결과를 보고한다. 테스트 통과는 완료가 아니다.
- 매 단계 커밋하고 푸시한다.
- 사용자에게는 한글로 보고, 코드·주석은 영어.
- 파일 경로는 `/Users/motodna/...` 전체 경로로 보여준다.
- **토큰·API 키를 요청하거나 채팅에 남기지 않는다.**
