```
■ F04 → ERP5 덧칠 — 헛돌기(아무것도 안 씀)
  f04fill-20260918040343 · 시트 사진 2026-09-18T03:35:53.293Z (28분 전) · 시트 실은 줄 467 · 보류 101 · ERP5 471줄

── 무엇이 바뀌나
   ① 이미 있는 줄 — ★안 올린다(건드리지 않음)   467
      이미 다 차 있어 안 바뀌는 줄         12
      ★값이 달라도 «안 건드린» 칸       1186   ← 덮지 않는다
   ② 시트에만 있어 «새로 세울» 줄          0
   ③ 보류를 settlement_held 에 둘 줄      0   (이미 둔 것 101)

── ⚠ ERP5 안에서 사람이 봐야 할 것 — 고치지 않고 알린다
   접수일이 오늘 뒤다        stl_77npvjuq74

── ★값이 달라 «안 건드린» 칸 — ERP5 값을 그대로 둔다
   sourceRow         457
   sourceTab         384
   billed            320
   paper              10
   delivered           7
   note                6
   cancelled           2

── 옮기지 «않은» 칸
   claim · pay   ERP5 가 claimWritten · payWritten 으로 이미 들고 있다
   clawback      ★환수는 «접수의 체크» 가 아니라 «반대 부호의 한 줄» — ERP5 는 settlement_clawbacks 로 따로 둔다
   fromTab       우리 리더의 꼬리표 — sourceTab · fromSheet 와 겹친다

── 칸별 — 새 칸(ERP5 에 칸이 없었다) / 빈 칸 메움(칸은 있는데 비어 있었다)
   billYearRaw        434       0
   billMonthRaw       434       0
   paperFee           397       0
   agentCode            0     345
   contractNo         101       0
   sourceTab            0      51
   claimVat            48       0
   claimTotal          48       0
   payVat              45       0
   payTotal            45       0
   billMonth            0      35
   nextRoundAt         22       0
   note                 0      12
   deliveredAt          0       6
   model                0       4
   supplier             0       3
   special              1       0
   adjustReason         0       1
   paperBy              1       0
   upsell               1       0

★헛돌기다 — 아무것도 안 썼다. 쓰려면 --apply (대표 확인 뒤).
```
