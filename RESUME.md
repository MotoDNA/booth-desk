# BOOTH DESK B2B Ver 3.0 — 재개 문서

이 파일부터 읽으면 됩니다. Ver 2.0 제품 규칙은 `CLAUDE.md`에 따로 있습니다.

## 지금 어디까지 왔나

명세서(사용자 제공 "BOOTH DESK B2B Ver 3.0 통합 개발 명세서") 기준 **STEP 1~8 + GAS 완료.**
다음은 **Gmail 발송** 또는 **STEP 10 (회사 인텔리전스).**

**지금 배포된 서버에는 STEP 8 코드가 없다.** `gs/`는 고쳤지만 Apps Script
편집기에는 아직 안 붙였다. 아래 "다음 단계"의 재배포부터 하면 된다.

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
| 8 | AI 이메일 초안 | ✅ 코드 완료 · **실제 배포 검증 남음** |
| — | Gmail 발송 + 중복 발송 방지(명세서 64) | 미착수 ← 다음 후보 |
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
│   ├── test.js                  스텁 환경 테스트 64개
│   └── README.md                설치 안내서 (비개발자용)
├── tool/mock_gas.py             모의 GAS 서버 (포트 8793)
└── .claude/launch.json          미리보기 서버 정의 (포트 8792)
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

## STEP 8에서 만든 것 (2026-08-15)

서버 `generateEmail` 액션 하나와, 후속 연락 카드에서 열리는 초안 화면 하나.

- `gs/AIService.gs` — `SYSTEM_EMAIL` + `emailDraft()`. 프롬프트는 서버에만
  있고 앱은 필드만 보낸다(리드 분석과 같은 구조). 반환값
  `{subject, body, summary, recommendedAction, recommendedFollowupDays,
  usedFacts, confidence}`. 모델이 HTML로 답해도 태그를 벗겨 평문으로 저장하고,
  제목은 한 줄로 눌러 두고, 후속 간격은 1~90일로 자른다. 빈 초안은 성공이
  아니라 오류다.
- **`usedFacts`** — 명세서 32번을 사람이 검사할 수 있게 만든 장치. 모델이
  "이 문장들을 근거로 썼다"고 되돌려 주고 화면에 그대로 보여 준다. 상담
  기록에 없는 게 거기 있으면 그 초안은 버리면 된다.
- 개인정보: 이메일 초안만 **이름을 보낸다**(인사말 때문에). 전화·주소·
  이메일 주소는 여전히 폰 밖으로 안 나간다. `aiEmailInput()`에 이유를 주석으로
  남겼다.
- 화면(`emDetail`): 경고 배너 → 받는 사람 → 초안 → 작성 언어 → AI 메모.
  버튼은 [다시 생성] [수정] [승인]. 수정 중에는 [취소] [저장].
  **발송 버튼은 없다.** 자동 발송 금지(명세서 33)라서가 아니라 아직 보낼
  길이 없어서다 — 화면에도 그렇게 적혀 있다.
- 승인은 따로 누르는 행위다. 승인 뒤에 본문을 고치면 승인이 자동으로 풀린다
  (승인한 문장과 나갈 문장이 달라지면 안 되므로). 사람이 고친 초안 위에
  [다시 생성]을 누르면 먼저 물어본다.
- **초안이 상하는 것을 알려 준다.** 초안을 쓸 때의 입력 해시를 저장해 두고,
  화면을 다시 열 때 리드 메모·요청이 바뀌었으면 파란 배너로 알린다. 초안
  자체는 지우지 않는다.
- 설정에 **이메일 서명** 칸(`cfg.emailSignature`). 서명은 프롬프트에 그대로
  실려 가고, 모델은 연락처를 지어내지 말라고 지시받는다 — 이메일에 연락처가
  들어가는 유일한 경로다.
- 후속 카드에 `초안`/`승인됨` 배지와 [이메일 초안]/[초안 보기] 버튼.
  서버 주소가 없으면 버튼은 안 보인다.
- 시트로는 `emailSubject`→`subject`, `emailBody`→`body`로 넘어간다
  (`SyncService.toRow`가 원래 하던 매핑, 이번에 테스트로 고정).

리드 분석에 있는 "같은 입력이면 캐시" 는 **이메일에는 일부러 안 넣었다.**
초안을 새로 쓰는 길은 "아직 초안 없음" 버튼과 [다시 생성] 둘뿐인데, [다시
생성]은 다른 문장을 달라는 뜻이라 이전 초안을 되돌려 주면 정확히 원하지
않은 짓이 된다. 해시는 위의 "상함" 표시에만 쓴다.

### 확인한 것

- `cd ~/booth-desk/gs && node test.js` → 64개 통과 (`ALLINONE=1`도 동일).
  프롬프트 주입, HTML 제거, 값 보정, 시트 매핑 포함.
- 모의 서버(포트 8793)를 붙인 실제 브라우저에서 전 과정 확인: 생성 → 수정 →
  저장 → 승인 → 수정하니 승인 해제 → 다시 생성(확인 질문) → 언어 바꿔 재생성
  → 서버 끊고 실패(기록 그대로 유지, 재시도 버튼) → 복구. 한/영/중 문자열
  누락 없음. JS 오류 없음.

### 남은 것

1. **실제 배포에서 확인.** 모의 서버는 프롬프트를 실행하지 않는다. `temperature`
   함정처럼 진짜 Claude에서만 드러나는 게 있으므로, 재배포 후 리드 하나로
   초안을 만들어 보고 **명세서 32번 위반(상담 안 한 내용·임의 가격)이 없는지**
   본문을 직접 읽어야 한다.
2. **Gmail 발송.** 승인된 초안이 갈 곳이 아직 없다. 발송을 붙일 때 명세서
   64번(중복 발송 방지)도 같이. `FollowUps` 시트에 `sentAt`/`sentBy`/
   `gmailMessageId`/`errorMessage` 칸과 `EmailLogs` 시트는 이미 있다.

### 재배포 (사용자가 함)

1. `preview_start({name:"booth-desk"})` 후 브라우저로
   `http://localhost:8792/gs/ALL_IN_ONE.html` 열기
2. ⌘A · ⌘C → Apps Script 편집기의 `Code.gs`에 통째로 붙여넣기
3. 배포 ▾ → 배포 관리 → ✏️ 연필 → 버전 **새 버전** → 배포
   ("새 배포"를 쓰면 URL이 바뀐다)
4. 앱 설정에서 [연결 확인] → 후속 탭 → [이메일 초안]

## 작업 방식 (사용자 요청)

- 각 단계 후 **실제 브라우저에서 확인**하고 결과를 보고한다. 테스트 통과는 완료가 아니다.
- 매 단계 커밋하고 푸시한다.
- 사용자에게는 한글로 보고, 코드·주석은 영어.
- 파일 경로는 `/Users/motodna/...` 전체 경로로 보여준다.
- **토큰·API 키를 요청하거나 채팅에 남기지 않는다.**
