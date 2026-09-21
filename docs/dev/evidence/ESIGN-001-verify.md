# DEV-CHANGE-ESIGN-001 — 검증 증거

| | |
|---|---|
| 대상 revision | `18f20827abf9ecf426dfe2ca7feebf5093d562e9` |
| 잰 자리 | `http://localhost:4321/admin-shell.html` (1600×950, light) |
| 잰 법 | 브라우저에서 **실행**해 얻은 값. 눈으로 본 것이 아니다 |
| 잰 때 | 2026-09-16 |

> ★잰 값만 적는다. 「좋아 보인다」는 증거가 아니다.

## CK-UNIT · CK-SYNTAX · CK-FORM

```
npm test                     pass 42 · fail 0
node --check                 data / app / esign / mobile  → 4 OK
validate-development-form    {"status":"PASS","errors":[]}
```

## EV-AC001 — 이름이 한 벌인가

세 자리에서 뽑은 문자열 집합을 비교했다.

```
목록 뱃지   ["검토 대기","발송 전","고객 작성 중","완료","작성"]
필터 칩     ["전체","작성","발송 전","고객 작성 중","검토 대기","완료","확인 필요"]
스테퍼      ["작성","발송 전","고객 작성 중","검토 대기","완료"]

뱃지 ⊂ 단계이름   true
칩  ⊂ 단계이름   true   (「전체」·「확인 필요」는 단계가 아니라 제외)
```

## EV-AC002 — 축이 둘로 갈려 있는가

```
ol.ecstep li 개수            5      (관리자 축)
.ecjour 존재                 true   (손님 축 — 별도 요소)
손님 축이 스테퍼에 섞였나      아니오
```

## EV-AC003 — 플래그가 단계를 «대체» 하지 않는가

목록 여섯 줄에서 `단계뱃지 | 플래그` 를 뽑았다.

```
검토 대기     |
발송 전       | 확인 필요
고객 작성 중  | 보완 1차
완료          |
고객 작성 중  | 만료
작성          | 확인 필요
```

단계 칸은 여섯 줄 모두 **다섯 이름 중 하나**이고, 플래그는 그 옆에 따로 붙는다.

## EV-AC004 — BLOCK 이 막는가 (E-2609-040)

```
링크 만들기 disabled        true
까닭이 글자로                "발송 전 확인 2건이 막고 있다"
막는 항목                    ["받는 곳(연락처)이 없다",
                             "공급사 「새턴렌탈」 사업자 정보가 비어 있다"]
카드 role                    "alert"
```

★막는 조건이 **하나가 아니다**. 내 전 시안은 연락처만 봤다.

## EV-AC005 — 대비 (합성 알파 포함)

반투명 배경을 흰색으로 세면 거짓말이 되므로, 조상 배경을 **합성**해서 쟀다.

```
전자계약 E-2609-040 (발송 전+BLOCK)   4.5 미만 0건
전자계약 E-2609-041 (검토 대기)       4.5 미만 0건
전자계약 E-2609-039 (보완 요청)       4.5 미만 0건
전자계약 E-2609-036 (만료)            4.5 미만 0건
전자계약 E-2609-038 (완료)            4.5 미만 0건
전자계약 E-2609-035 (작성)            4.5 미만 0건
product / intake / settle·perf / settle·bill / settle·pay
                                      4.5 미만 0건
```

고치기 «전» 에 걸린 것들 — 이것이 고친 근거다:

| 무엇 | 전 | 뒤 | 왜 |
|---|---|---|---|
| `--ink-3` 본문 | **3.90** | 4.72 | ★«판»(`--card`) 위에선 4.9 였는데 «띠»(`--tint`) 위에선 3.9 였다. **가장 밝은 바탕** 기준으로 다시 잡았다 → `#5f6871` |
| `ol.ecstep li.on .n2` | **3.62** | 12.4 | 반투명 흰(26%) 위의 흰 글씨. 칩을 채워 색을 뒤집었다 |
| `.fd .fx .b` | **3.95** | 통과 | 같은 병 |
| `.kv dt` | **3.71** | 통과 | 정의 목록의 «말»은 장식이 아니라 내용이다 |
| `.a4kv span` · `.a4sign` | **3.75** | 통과 | 흰 종이 위라 따로 잡았다 |
| `ol.ecstep li` 안 지난 단계 | **4.35** | 통과 | 안 지났다고 «안 보여도» 되는 건 아니다 |

## EV-AC006 — 토큰

`:root` 에 AI Core 이름 27개를 선언하고 우리 값에 이었다.
값이 다른 여덟은 [AI-CORE-CONFORMANCE.md §1-1](../AI-CORE-CONFORMANCE.md) 에 까닭과 함께 적었다.
아직 못 지킨 것 다섯도 §2-1 에 적었다 — **「적합」이 아니라 「부분 적합」** 이다.

## EV-AC007 — 「고객 작성 중」에 할 일이 없는가 (E-2609-039)

```
제목           "지금 단계 — 고객 작성 중"
문구           "★우리가 할 일은 없다. 고객이 쓰는 중이라 기다린다.
                재촉이 필요하면 링크를 다시 전달하고, 잘못 나갔으면 해지한다."
단추           ["링크 복사","링크 해지"]
주 단추 없음    true
```

## EV-AC008 — 빈 상태 둘이 다른가

```
조건에 안 맞음   제목 "이 조건에 맞는 계약이 없다"
                 다음 "조건 지우고 전체 보기"
자료가 없음      제목 "아직 계약이 없다"
                 다음 "계약서 만들기"
둘이 다른가       true  (제목·다음 행동 모두)
```

## 안 한 것 — 숨기지 않는다

- `LOADING` 상태 — 시안은 고정 표본을 동기로 그린다. 잴 것이 없다
- 키보드 전용 통과 시험 · 200% 확대 — 안 돌렸다
- 독립 검토 — 없다. 여기 값은 **전부 내가 낸 것**이고, AI Core 기준으로
  「self-authored checks passed」 까지다. 「independently reviewed」 가 아니다

## 관문 — AI Core `deriveActions` 가 말하는 «지금 할 수 있는 것»

```
ON   save_draft
ON   mark_ready
ON   start_isolated_work
ON   request_review
ON   close
HOLD run_verification      — WORK_NOT_IMPLEMENTED   (lane 이 시안 계층이라 그렇다)
HOLD safe_commit_push      — WORK_NOT_IN_PROGRESS
HOLD request_authorization — AUTHORIZATION_REQUEST_NOT_NEEDED
HOLD merge_or_deploy       — RELEASE_NOT_READY, RELEASE_ACTION_REQUIRED,
                             RELEASE_TARGET_REQUIRED, RELEASE_REVISION_MISMATCH,
                             ★REVIEW_REQUIRED
HOLD observe_outcome       — RELEASE_REQUIRED, RELEASE_EVIDENCE_REQUIRED
```

★**머지는 막혀 있다** — `REVIEW_REQUIRED`. 내가 낸 검증만으로는 안 열린다.
다음 칸은 `request_review` 다.
