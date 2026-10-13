# 옛 가지 `work/freepass-admin/ledger-commission-read-20261003` 감사 (2026-10-13)

- 기준: `origin/main` 8e3ac64 (#197) · 옛 가지 끝 3e76336 · 공통 조상 dd06534 · 옛 PR #171 은 2026-10-10 반영 없이 닫힘.
- 방법: ① `git cherry` ② 커밋별 `cherry-pick --no-commit` 시험 적용 ③ 커밋별 코드 추가 줄이 현재 main 파일에 그대로 있는지 집계 ④ main 쪽 통합·폐기 커밋(#182·#186·#187·#189)과 `docs/HANDOFF.md` 결정 대조.
- 결론: **옮길 가치가 남은 커밋 없음.** 옛 가지 끝 전체가 #182 «Sanitize PR171 settlement integration» 으로 비식별화되어 main 에 들어갔고(차이는 이메일·시트 ID·차량번호·실명을 가린 것뿐), 그 뒤 #186(월 PDF 생성 경로 제거)·#187(옛 수수료 계산 길 삭제)·#189(정산표 화면) 가 일부를 의도적으로 걷어냈다. 남은 차이는 (a) 의도적으로 폐기된 경로, (b) 공개 저장소에 둘 수 없는 원문 식별값·시트 쓰기 경로 뿐이다.

## 커밋별 판정 (오래된 것부터)

| # | 커밋 | 제목 | 판정 | 근거 |
|---|---|---|---|---|
| 1 | 3b63546 | feat(ledger): read FreePass Data per-term commissions into intake | 이미 main 에 있음 + 일부 낡음 | 추가 193줄 중 118줄 main 에 그대로. 없는 줄은 수수료표 되돌림(`loadFeeRuleSet`/`feeOf`) 경로로 #187 이 삭제 |
| 2 | 96b1742 | fix(ledger): product intake without published Data fees stays 미확정 | 낡음 | 규칙 되돌림 전제의 시험·표시. main 은 «미확정» 표시 자체는 유지(#187 이후 Data 저장값만 읽음) |
| 3 | 18e2800 | test(firestore): give emulator product offers published Data fees | 이미 main 에 있음 | 빈 패치(동일 내용) |
| 4 | 203e6ef | feat(settlement): 뮤카 수수료 규칙·지급표 연결·수동 입력 안전장치·마진 음수 경고 | 이미 main 에 있음 + 일부 낡음 | `fee-rules-f04-extra`·뮤카 gaTable·`mewcarPayoutWarning`·시험 모두 main 에(이름만 비식별). `fee-rules-to-erp5.mts` 는 #187 삭제 |
| 5 | c4963f3 | fix(settlement): 청구서 발행자 정보는 비공개 설정 파일에서 읽는다 | 낡음 | 대상 스크립트 `generate-monthly-settlement-pdf.mts` 자체가 #186 에서 제거 |
| 6 | d887899 | fix(settlement): restore intake-only two-tab ledger | 이미 main 에 있음 + 일부 낡음 | 두 탭 가드(`F04_LEDGER_TABS`·`assertIntakeOnlySnapshot`)는 main 에. 시트 금액 투영(`intakeMoney`)은 #187, 월 PDF 연결은 #186 에서 삭제 |
| 7 | f37c80f | fix(settlement): block invoices with unresolved claim states | 이미 main 에 있음 | 빈 패치 |
| 8 | a3732b9 | fix: retain intake calculation evidence in F04 snapshots | 낡음 | `f04-ssot.mts` 의 산출근거 투영은 #187 에서 삭제(새 F04 snapshot 은 수수료·청구·지급 금액을 공급하지 않음) |
| 9 | 6165ff0 | fix: keep calculation basis input text unchanged | 낡음 | 8번과 같은 줄 |
| 10 | 0516c28 | feat(f04): persist supplier and agent basis from monetary notes | 이미 main 에 있음 + 금지 | `f04-basis-from-notes.mjs` 는 #182 에 dry-run·self-test 전용으로 있음. 옛 가지 버전은 시트 ID 원문과 `--apply` 쓰기 경로를 담고 있어 공개 저장소 규칙상 옮기지 않음 |
| 11 | 4e87d5a | fix(f04): preserve (직원 실명) intake entries from automated edits — 제목의 실명은 가림 | 이미 main 에 있음 + 금지 | main 은 환경변수 기반 보호 목록. 옛 가지는 차량번호 원문 하드코딩 |
| 12 | cdc855e | docs(f04): preserve normal filtering without redundant warnings | 이미 main 에 있음 | F04-SSOT.md 변경이 #182 에 포함 |
| 13 | 3b60b10 | docs(admin): consolidate product intake handoff into receipt work | 이미 main 에 있음 | HANDOFF.md 변경이 #182 에 포함 |
| 14 | 0d91dc1 | fix(admin): patch vulnerable dependencies and record unified integration gates | 이미 main 에 있음 | lock 변경이 #182 에 동일 포함, 이후 #183 이 next 추가 패치 |
| 15 | 368c871 | docs(admin): pin unified task owner and GHD merge ownership | 이미 main 에 있음 | registry 변경이 #182 에 포함 |
| 16 | 790a47d | fix(f04): compact daily receipt layout and basis labels | 낡음 | 시트 행 높이·서식 쓰기(`formatBasis`)는 쓰기 경로와 함께 제거. 라벨 축약은 dry-run 에 무의미 |
| 17 | 497718c | docs(admin): preserve exact branch audit and latest receipt integration | 이미 main 에 있음 | 은퇴 등록부 항목이 #182 에 포함 |
| 18 | 681549c | docs(admin): persist reuse-first entry rules in the existing integration task | 이미 main 에 있음 | AGENTS.md +9줄이 #182 에 동일 |
| 19 | 0a300d6 | fix(master): exclude retired nodes and read canonical submodel aliases | 이미 main 에 있음 | 추가 18줄 전부 main 에 그대로 |
| 20 | c3bdf86 | fix(settlement): read published monthly receipt amounts with live digest guard | 이미 main 에 있음(후속 형태) | `readPublishedReceipts` 는 22번 형태로 main 의 settlement-repository·ledger 화면에 유지. 정산 화면 쪽은 #189 정산표로 대체 |
| 21 | 0f0c44c | fix(settlement): preserve search alignment around monthly summary | 낡음 | `SettlementScreen` 의 월 합계 문구 — #189 가 화면을 정산표로 대체 |
| 22 | ba83bfb | fix(settlement): reuse screen ledger receipt and disclose source freshness | 이미 main 에 있음 | 추가 66줄 중 58줄 그대로, 나머지는 21번과 같은 문구 |
| 23 | 5a4afa4 | fix(settlement): reject partial ledger snapshots and verify shared wiring | 이미 main 에 있음 | 추가 8줄 전부 그대로 |
| 24 | e2f5e6b | feat(admin): generate verified monthly receipt PDFs on existing Drive IDs | 낡음 | 월 PDF 생성 경로(`settlement-documents.ts`·서버 액션·버튼)는 #186 에서 대표 10-10 승인으로 제거. `settlement-invoice-html.ts` 와 `invoice-document.ts` 의 `buildReceiptDocuments` 는 시험만 부르는 상태로 main 에 남음(정리 후보, 이 작업 범위 밖) |
| 25 | 4e770cd | fix(admin): apply shared desktop monthly document button style | 낡음 | 버튼 자체가 #186 에서 제거 |
| 26 | 1a6da53 | fix(admin): use neutral styling while monthly documents are unavailable | 낡음 | 25번과 같음 |
| 27 | a1c7788 | fix(admin): verify receipt basis against recorded rates and fee source | 낡음 | 요율로 산식을 재구성하는 `verifiedReceiptBasis` 는 #187 과 HANDOFF 「receiptRowBasis 는 기존 기재액 설명만 유지하며 현재 요율로 산식을 재구성하지 않는다」 에 반함. 기재액 설명 부분(36/80줄)은 main 에 있음. 단 #187 이 함수를 지우면서 호출부 `scripts/f04-basis-from-notes.mjs` 를 안 고쳐 dry-run 이 TypeError 로 죽는 상태였음 → 아래 «발견한 결함» 에서 정책대로 정리 |
| 28 | 3e76336 | fix(admin): retain known formula-cell amounts in basis evidence contract | 낡음 | UI SSOT json 의 월 PDF 항목은 #186 에서 제거 |
| — | f985fde·10ad66f·a990ff1·65a6781·6d33c47 | Merge commit … | 내용 없음 | 병합 커밋 |

## 전체 시험 분류 (origin/main 8e3ac64, Windows 로컬)

| 결과 | 수 |
|---|---|
| 전체 | 919 |
| 통과 | 907 |
| 실패 | 12 (전부 `src/adapters/esign/puppeteer-final-document-renderer.test.ts`) |

| 원인 | 건수 | 판정 |
|---|---|---|
| `@sparticuz/chromium` 가 Linux 전용 바이너리라 Windows 에서 `%TEMP%\chromium` 경로가 없음(ENOENT) | 10 | 환경. CI(ubuntu) 는 같은 커밋에서 통과(#194 체크 전부 SUCCESS) |
| `public/fonts` 없음(`--ignore-scripts` 로 설치해 postinstall `install-fonts.mjs` 가 안 돈 것) | 2 | 환경. `node scripts/install-fonts.mjs` 뒤 통과 |

- 로컬 Chrome 을 `ESIGN_CHROMIUM_EXECUTABLE_PATH` 로 지정해도 Linux 전용 실행 인자(`chromium.args`) 때문에 `template-script` 단계에서 시간초과한다(실행 로그: 8건 46초 TimeoutError). 시험 파일의 두 곳(270·321행)은 환경변수를 거치지 않고 `chromium.executablePath()` 를 직접 부른다 — 결함은 아니고 Windows 이식성 문제.
- **이 실행(2026-10-13, Windows, node 24)에서 확인된 코드 결함 없음.** 12건 모두 환경 원인이고, 같은 커밋이 CI(ubuntu) 에서는 통과했다. `npm run typecheck` 도 통과.

## 발견한 결함 1건 (`npm test` 밖, Codex 검토로 발견)

- `scripts/f04-basis-from-notes.mjs` 가 `src/domain/settlement/fee.ts` 의 `verifiedReceiptBasis` 를 `tsImport` 로 가져와 `sourceRowBasis` 에서 호출했는데, 그 함수는 #187 에서 삭제됐다(HANDOFF 「삭제 함수 … verifiedReceiptBasis 15」). `--self-test` 는 `sourceRowBasis` 를 안 거쳐 통과했지만, 실제 `--dry-run` 은 금액 있는 첫 줄에서 `verifiedReceiptBasis is not a function` 으로 죽는다.
- 고친 방법(정책 따름, 옛 계산 복원 아님): 수수료표 탭 읽기와 요율 재구성(`sourceRowBasis`) 을 걷어내고, 이미 있던 메모 기반 `makeBasis(claim, pay)` 만 쓴다(#187 「요율 계산 없이」·HANDOFF 「현재 요율로 산식을 재구성하지 않는다」). `tsx` 의존도 같이 빠짐. 자체 시험에 `makeBasis` 양쪽 출력 한 건 추가(12 PASS).

## PR #194 합침 가능 여부

- 상태: OPEN · `mergeable: MERGEABLE`(충돌 없음) · `mergeStateStatus: BEHIND`(main 보다 2커밋 뒤) · 리뷰 없음(필수 승인 수 0) · 문서 2파일 +2줄.
- 체크: verify·canon·runtime·visual-qa·core-domain·backend·firestore-freepass-data 모두 SUCCESS, `Vercel` 은 PENDING(필수 컨텍스트).
- main 보호 규칙은 `strict` 상태 검사라 BEHIND 상태로는 합칠 수 없다. 가지를 main 최신으로 갱신하고 Vercel 체크가 끝나면 합칠 수 있다. 머지는 이 작업 범위 밖.
