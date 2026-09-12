# Ether Hunt — 第三方胜率评估简报（v2）

**用途：** 把本文完整粘贴给第三方 AI，请其按 ETHOnline 2026 / ETHGlobal Classic 规则评估获奖概率。  
**报告时点：** 2026-09-10（UTC+8 约 22:50）· **距提交截止约 3 天**  
**项目：** Ether Hunt · Classic (From Scratch)  
**公开仓库：** https://github.com/Linus-Shyu/Ether-Hunt  
**截止：** Sun Sep 13, 2026 12:00 pm EDT（不可迟交）  
**上一版：** 2026-09-05（v1）；本版反映 Graph 保底、链上凭证文档、demo 录屏草稿评估后的状态。

---

## 给评估 AI 的指令（请严格遵守）

请你作为 **ETHOnline 2026 异步评审模拟器**，输出：

1. **各赛道独立概率**（0–100%，并给置信区间）：  
   - Hedera — AI & Agentic Payments ($6k)  
   - The Graph — Best AI Use Case From Scratch ($5k)  
   - Arc — Best Agentic Economy with Circle Agent Stack ($2.5k)  
   - Classic 主赛道进 Finalist / 总冠军量级（分开估）
2. **资格硬门槛**：哪些已满足 / 未满足 / 有风险。
3. **相对同赛道预期对手的优劣势**（至少各 3 条）。
4. **在截止前可提升胜率的 TOP 5 动作**（按 ROI 排序；今天已是 9/10）。
5. **一句话总判决**（能否认真冲奖、冲哪条）。

评估原则：

- 以「评委能否在 ≤5 分钟内独立验证」为准，不因叙事漂亮加分。  
- Mock / bypass / 本地假支付 **不计** 为奖项证明。  
- Continuity-only 奖项不适用本项目（本项目是 Classic 绿场）。  
- 不要因为「想法好」给高分；**官方表单未最终提交前**，所有夺奖概率必须乘以「提交完成风险」。  
- 若信息不足，明确写出假设，不要假装有把握。  
- 区分：**技术资格潜力** vs **完赛后夺奖概率** vs **视频质量对异步评审的折损**。

---

## 1. 产品一句话

**Pay-per-scan 链上授权（allowance）审计：**  
Agent 或网页代理用 **$0.01 USDC** 完成一次真实支付 → API 从 **自建 The Graph 子图** 拉 live 证据 → 规则检测器 + **只能引用真实 evidence ID** 的 LLM → UI 输出档案（风险仪表、授权关系图、revoke 队列、可验证伙伴证明轨、PDF）。

核心差异化主张：**可验证的付费门 + Graph grounding，而不是又一个「AI 看链」聊天框。**

---

## 2. 锁定奖项与官方资格对照

团队提交时最多选 **3** 个 partner（已锁定）：

| # | Partner | 目标轨道 | 奖金量级 | 官方硬条件（摘要） | 本项目现状（2026-09-10） |
| --- | --- | --- | --- | --- | --- |
| 1 | Hedera | AI & Agentic Payments | $6,000 | live **x402-gated** 服务（Hedera + **Blocky402**）；≥1 次真实付费；README + ≤5 min demo | **Live gate + 真实 settle 已验证**；HashScan + mirror JSON 写进 README/`docs/onchain-proofs.md`；UI Prove-the-gate；**demo 录屏草稿已有，官方表单视频尚未最终提交** |
| 2 | The Graph | Best AI Tooling/Use Case — **From Scratch** | $5,000 | Classic；AI 使用 Graph 作 **live** 链数据；mock/static 不合格 | **自建 Studio 子图 v0.0.2**（`Allowance`/`Account`/`Spender`）；**v0.0.1 tip-synced fallback**；**9 Case Files boot 预热**；cite-only AI；可复制 GraphQL |
| 3 | Arc | Best Agentic Economy / Circle Agent Stack | $2,500 | agents + wallets + USDC / Agent Stack / nanopayments | **`POST /audit/arc` + Gateway nanopay + agent wallet**；Gateway payment id + Arcscan 地址写进文档；**同上：录屏草稿有、表单未交** |

**非目标：** 1inch / Uniswap / World / Privy / Chainlink / Ledger / Bazantic / 0G。  
**主奖：** Classic Finalist / 总排名 — 优先级低于三条 partner，但仍要评估。

---

## 3. Classic 合规现状

| 规则 | 状态 | 证据 |
| --- | --- | --- |
| 从零开始（kickoff 后写产品） | ✅ | 首批产品 commit：`2026-09-04`；仓库创建同日；无 kickoff 前产品代码 |
| 公开 GitHub | ✅ | https://github.com/Linus-Shyu/Ether-Hunt · public |
| 版本控制 / 可读历史 | ✅偏灰 | **约 43 commits**（至报告时点）；功能拆分清晰；存在批提交时间戳痕迹 |
| 频繁小步提交 | ⚠ | 优于巨型 dump；非教科书增量，通常不致 DQ |
| AI 不得包办全项目 | ⚠需诚实 | Cursor 大量辅助；`docs/ai-attribution.md` 有表；人类负责产品锁定、账号、live 验证、录屏 |
| Demo 视频 2–4 min、≥720p、**不加速**、真人旁白 | ⚠草稿存在 / 未官方提交 | 本地录屏评估见 §5；**ETHGlobal 表单未勾选完成前仍算提交风险** |
| New vs reused 文档 | ✅ | README 有表 |
| 安全默认（无硬编码密钥） | ✅基本 | `.env` gitignored |

---

## 4. 技术架构（评委可验证路径）

```
Web (Vite) ──Pay & hunt──▶ audit-api :8787
   │                         ├ POST /audit      → Hedera x402 (402 → settle → 200)
   │                         ├ POST /audit/arc  → Arc Gateway nanopay
   │                         ├ POST /scan/*     → UI buyer proxy (仍走真实 settle)
   │                         ├ Graph client     → v0.0.2 primary + v0.0.1 fallback
   │                         ├ Case Files warm  → 9 presets cached on boot
   │                         ├ detectors        → structured links + spender registry
   │                         └ LLM synthesize   → cite-only
   └ Prove the gate → unpaid 402 decode (scheme/network/price/payTo)
```

**关键路径：**

- Hedera：`DEV_BYPASS_PAYMENT=false` → 未付款 `POST /audit` → **402** → settle → `rail = hedera-x402`  
- Arc：`POST /audit/arc` → `rail = arc-gateway`  
- Graph：primary `…/v0.0.2`；subject 空时 fallback `…/v0.0.1`；报告暴露 mode + query  
- Local：`/scan/local` = unpaid/dev-bypass — **不能**当作 partner 支付证明

**子图设计要点：**

- Mapping 折叠 live allowance：`unlimited` / `revoked` / peak / re-approval；`Account`/`Spender` 聚合。  
- 检测器读结构化字段。  
- `startBlock: 19000000`（主网 USDC）。窗口外历史可能空卷宗 — 故有 Case Files + fallback。

---

## 5. Demo 视频草稿评估（2026-09-10 内部审片）

**文件：** `Cap 2026-09-10 at 00.01.08.mp4`（本地，尚未确认是否已上传 ETHGlobal）

| 项 | 实测 |
| --- | --- |
| 时长 | **~195s（3:15）** — 合规 2–4 min |
| 分辨率 | **1600×1080** ≥720p |
| 编码 | H.264 + AAC |
| 旁白 | 真人出镜 + 麦克风；全程有人声（非 TTS） |
| 加速 | 未见加速痕迹（60fps，时长与帧数一致） |
| 体积 | **~578MB** — 上传前需压缩，否则提交失败风险 |

**画面覆盖到的内容（异步评委能看到）：**

1. 落地页 + Hedera / Graph / Arc 状态芯片  
2. Hedera x402：**Pay & hunt → Settling → findings**（unlimited allowance、cites）  
3. PDF / 打印对话框导出报告  
4. Case Files 面板  
5. Arc Gateway：**Paying Arc… → 402 → SETTLE/HUNT**  
6. 中途切到 **Etherscan**（MEV bot 地址）— **偏题，可能稀释 WOW**

**审片问题（会折损异步胜率）：**

- 右下角摄像头遮挡 CTA（Pay & hunt）  
- Arc settle 等待时有 **~7s 静音空档**；日志停在 “Still settling…12s”  
- 打印对话框画面丑  
- 浏览器多标签杂乱（Ether Hunt ×2、Etherscan、X）  
- 未清晰特写 README / HashScan 链上凭证点击路径（文档有，视频弱）

**内部可用度粗评：** 合规可交约 **8.5/10**；异步说服力约 **6.5–7.5/10**。重录收紧可抬到 **8.5+**。

---

## 6. Live / 文档状态快照（相对 v1 的变化）

| 项 | v1（9/05） | v2（9/10） |
| --- | --- | --- |
| Subgraph v0.0.2 | 已部署，大幅追块缺口 | 仍可能未满 tip；**已加 v0.0.1 fallback + Case File 预热** |
| 链上凭证 | 分散 / 未系统化 | **README + `docs/onchain-proofs.md` 显式 HashScan / Arcscan** |
| PDF / terminal UX | 有 about:blank / 遮挡问题 | **已修** |
| 提交素材 | 缺 | Logo / cover SVG 已入库 |
| Demo 视频 | ❌ | **草稿存在；官方提交状态未知（评估时按“未最终提交”降权）** |
| Commits | ~38 | **~43** |

**Hedera 参考 settle：**  
https://hashscan.io/testnet/transaction/0.0.7162784@1788621320.334383663  

**Arc 参考：** Gateway payment id `39d15216-297d-4520-8b96-3a69561ccbfe` · Agent SCA / Seller 见 README。

**Graph endpoints：**

- Primary: `https://api.studio.thegraph.com/query/1758666/ether-hunt-approvals/v0.0.2`  
- Fallback: `https://api.studio.thegraph.com/query/1758666/ether-hunt-approvals/v0.0.1`  
- Studio: https://thegraph.com/studio/subgraph/ether-hunt-approvals  

---

## 7. 已完成 vs 未完成（诚实清单）

### 已完成

- 双轨真实支付：Hedera ExactScheme + Blocky402；Arc Circle Gateway / Agent Stack  
- 402 挑战现场解码；Verifiable rails + explorer 链接文档化  
- From-Scratch 子图 + allowance-state + API fallback + Case Files warm  
- Cite-only LLM + 命名 spender 检测器（Permit2 / Uniswap / Morpho / Balancer / Curve 等）  
- Dossier UX：风险仪表、授权图、revoke、PDF、分享  
- README / prize-checklist / onchain-proofs / demo-script / AI attribution  
- Classic kickoff 合规、公开仓  
- Demo 录屏草稿（合规参数满足）

### 未完成 / 高风险缺口

1. **ETHGlobal 官方提交包是否已最终提交**（视频上传 + 勾选 3 partners + 表单）—— 截止前最大单点风险  
2. Demo 视频质量未达「冲奖剪辑」水平（空档、偏题、遮挡、体积过大）  
3. prize-checklist 中「Demo clip」条目仍未勾（相对正式提交通道）  
4. Hedera Prefer 清单（metering、A2A、ERC-8004、HCS 等）大多未做 — 影响冲一等奖天花板  
5. 品类拥挤：授权审计不稀缺；差异化在付费 agent + 可验证 Graph  
6. Commit 批量化时间戳 — 轻微观感风险  

---

## 8. 分赛道论证（供概率校准）

### 8.1 Hedera（相对最强席位）

**支持：** live x402 + ≥1 paid + HashScan 可点验；异步友好；认真做 agentic payment 的队伍通常更少。  
**压低：** Prefer 加分项薄；视频节奏一般；testnet 依赖；夺奖仍看同赛道对手深度。

### 8.2 The Graph From Scratch

**支持：** 自建子图 + 风险语义 schema；cite-only AI；fallback/Case Files 降低「空卷宗」翻车率。  
**压低：** 「AI + Graph」赛道极卷；单 token probe；若评委只看 v0.0.2 未追平或只看薄镜像旧印象会误判；AI tooling 深度未必压过专做 Graph MCP/工具链的队。

### 8.3 Arc Agent Stack

**支持：** 真实第二条轨；Agent wallet + Gateway nanopay 对齐文案；双轨证明 agentic economy。  
**压低：** 奖金池小；集成深度可能停在「能付一次」；视频里 Arc 等待段最拖。

### 8.4 Classic Finalist / 总榜

**支持：** Technicality 尚可（双支付 + 自建索引）；Usability 有可验证 UI。  
**压低：** Originality 中等；WOW 绑视频；品类不新；Finalist 约 top 20% 筛，总冠军极难。

---

## 9. 内部参考基线（非权威，供第三方校准 / 推翻）

假设：**在 9/13 截止前完成官方提交且视频合规（可用现有草稿或轻改）。**

| 结果 | 粗估夺奖/晋级率 | 备注 |
| --- | --- | --- |
| Hedera 奖 | **20–38%** | 资格接近满分；夺奖看对手与视频 |
| Graph From Scratch 奖 | **10–22%** | fallback 后演示更稳，赛道仍挤 |
| Arc Agent Stack 奖 | **15–32%** | 竞争可能更少；视频等待段折损 |
| Classic Finalist | **12–28%** | 强依赖视频与异步材料清晰度 |
| Classic 总冠军量级 | **&lt;3%** | 不作为目标 |

**若官方表单未交 / 视频被拒：** 所有夺奖概率视为 **≈0（未完赛）**，仅保留技术资格潜力。  
**若重录并砍掉 Etherscan 偏题 + 压缩等待：** 可将 Hedera/Arc/Finalist 各上调约 **3–8 个百分点**（主观）。

---

## 10. 第三方请使用的评分表（建议）

对每条 partner 轨道打分（1–5），再映射概率：

| 维度 | 权重建议 | 评分提示 |
| --- | --- | --- |
| 资格硬门槛满足度 | 30% | live / 非 mock / ≥1 paid / from-scratch subgraph |
| 可验证性（异步） | 20% | README、402、explorer、可复制 query、Case Files |
| 技术深度 / 原创 | 20% | 是否超越「接一下 SDK」 |
| 演示完整度 | 20% | 视频质量、稳定性、有无空档/偏题 |
| 文档与合规 | 10% | Classic、AI attribution、new vs reused、是否已正式提交 |

---

## 11. 建议第三方输出格式

```text
### Verdict
<一句话>

### Probability
- Hedera: xx% (CI: a–b%) · confidence: low/med/high
- Graph: xx% …
- Arc: xx% …
- Finalist: xx% …
- Grand prize tier: xx% …

### Hard-gate checklist
- pass / fail / at-risk …

### Strengths
- …

### Weaknesses / DQ risks
- …

### TOP 5 ROI actions before Sep 13
1. …
```

---

## 12. 材料链接（评测时可打开）

- Repo: https://github.com/Linus-Shyu/Ether-Hunt  
- README（含 on-chain proofs 摘要）  
- `docs/prize-checklist.md`  
- `docs/onchain-proofs.md`  
- `docs/demo-script.md`  
- `docs/ai-attribution.md`  
- Subgraph: `subgraphs/token-approvals/` · Studio `ether-hunt-approvals`  
- 本简报: `docs/win-rate-evaluation-brief.md`  
- 本地 demo 草稿（若评估方有权限）：`Cap 2026-09-10 at 00.01.08.mp4`（3:15 / 1080p / 真人旁白）

---

## 13. 已知偏见与诚实声明

- 本简报由项目构建助手整理，**存在乐观偏差风险**；已单列缺口、视频折损与提交风险。  
- 黑客松结果高度依赖当届对手池与评委口味，概率不可精确校准。  
- **完赛 ≠ 获奖**；当前更接近 **资格扎实 + Partner 有真实机会 + Finalist 偏难**，不是稳拿。  
- 评估时请把「能跑」「能交」「能赢」分开算。
