```
■ F04 → ERP5 덧칠 ★실제로 씀
  f04fill-20260918033604 · 시트 사진 2026-09-18T03:35:53.293Z (0분 전) · 시트 실은 줄 467 · 보류 101 · ERP5 461줄

── 무엇이 바뀌나
   ① 이미 있는 줄 — ★안 올린다(건드리지 않음)   457
      이미 다 차 있어 안 바뀌는 줄          2
      ★값이 달라도 «안 건드린» 칸       1186   ← 덮지 않는다
   ② 시트에만 있어 «새로 세울» 줄         10
   ③ 보류를 settlement_held 에 둘 줄    101   (이미 둔 것 0)

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
   adjustReason         1       0
   paperBy              1       0
   upsell               1       0

── 새로 세울 줄
   stl_dwynzn6puj   유○○ · 웰릭스(발주건) · 싼타페
   stl_e7j2ttu384   이○○ · 손오공 · 레이
   stl_5qne4ds5q8   이○○ · 오토플러스 · GV70 기본형
   stl_4hy753g5aq   우○○ · 오토플러스 · G80 RG3 FL
   stl_x9gsyndf24   박○○ · 손오공 · 5시리즈 G30 520i
   stl_q92sb5n8ru   이○○ · 아이카 · 싼타페 MX5 익스클루시브
   stl_yvrrvmh5hp   전○○ · 경진카 · 더 뉴 아반떼 CN7 스마트
   stl_ugdp6zpbqd   윤○○ · 빌린카 · SM3 Z.E. RE
   stl_u47n7ftygk   배○○ · 빌린카 · 쏘나타 디 엣지 DN8 비즈니스
   stl_p7qm9gjvgk   이○○ · 손오공 · G80

★썼다.
   문서 111개를 썼다.
```
