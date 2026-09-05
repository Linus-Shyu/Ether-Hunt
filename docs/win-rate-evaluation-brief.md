# Ether Hunt — 第三方胜率评估简报

**用途：** 把本文完整粘贴给第三方 AI，请其按 ETHOnline 2026 / ETHGlobal Classic 规则评估获奖概率。  
**报告时点：** 2026-09-05（UTC+8 约 22:50）  
**项目：** Ether Hunt · Classic (From Scratch)  
**公开仓库：** https://github.com/Linus-Shyu/Ether-Hunt  
**截止：** Sun Sep 13, 2026 12:00 pm EDT（不可迟交）

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
4. **在截止前可提升胜率的 TOP 5 动作**（按 ROI 排序）。
5. **一句话总判决**（能否认真冲奖、冲哪条）。

评估原则：

- 以「评委能否在 ≤5 分钟内独立验证」为准，不因叙事漂亮加分。  
- Mock / bypass / 本地假支付 **不计** 为奖项证明。  
- Continuity-only 奖项不适用本项目（本项目是 Classic 绿场）。  
- 不要因为「想法好」给高分；缺 demo 视频或缺 live 证明必须大幅降权。  
- 若信息不足，明确写出假设，不要假装有把握。

---

## 1. 产品一句话

**Pay-per-scan 链上授权（allowance）审计：**  
Agent 或网页代理用 **$0.01 USDC** 完成一次真实支付 → API 从 **自建 The Graph 子图** 拉 live 证据 → 规则检测器 + **只能引用真实 evidence ID** 的 LLM → UI 输出档案（风险仪表、授权关系图、revoke 队列、可验证伙伴证明轨、PDF）。

核心差异化主张：**可验证的付费门 + Graph  grounding，而不是又一个「AI 看链」聊天框。**

---

## 2. 锁定奖项与官方资格对照

团队提交时最多选 **3** 个 partner（已锁定，勿建议换座，除非明确说明 trade-off）：

| # | Partner | 目标轨道 | 奖金量级 | 官方硬条件（摘要） | 本项目现状 |
| --- | --- | --- | --- | --- | --- |
| 1 | Hedera | AI & Agentic Payments | $6,000 | live **x402-gated** 服务（Hedera testnet/mainnet via **Blocky402**）；consumer agent/平台完成 ≥1 次真实付费请求；README + ≤5 min demo | **已实现 live gate + 真实 settle**；UI「Prove the gate」可解码 402；HashScan 可链结算；**demo 视频未拍** |
| 2 | The Graph | Best AI Tooling/Use Case — **From Scratch** | $5,000 | Classic 合格；AI 使用 Graph 作 **live chain data**；纯 mock/local/static 不合格 | **自建 Studio 子图** `ether-hunt-approvals` **v0.0.2** 已部署，schema 含 `Allowance`/`Account`/`Spender` 索引时聚合；API 实测 `mode=allowance-state`；AI cite-only；**v0.0.2 仍在追块（见下）** |
| 3 | Arc | Best Agentic Economy / Circle Agent Stack | $2,500 | agents + wallets + USDC / Agent Stack / nanopayments | **`POST /audit/arc` + Circle Gateway nanopay + agent wallet**；UI Arc rail 可一键付；**demo 视频未拍** |

**非目标：** 1inch / Uniswap / World / Privy / Chainlink / Ledger / Bazantic / 0G（0G 不在奖项页）。  
**主奖：** Classic Finalist / 总排名 — 优先级低于三条 partner，但仍要评估。

---

## 3. Classic 合规现状

| 规则 | 状态 | 证据 |
| --- | --- | --- |
| 从零开始（kickoff 后写产品） | ✅ | 首批产品 commit：`2026-09-04T22:06+08`；仓库创建 `2026-09-04T14:13Z`；无 kickoff 前产品代码 |
| 公开 GitHub | ✅ | https://github.com/Linus-Shyu/Ether-Hunt · `isPrivate=false` |
| 版本控制 / 可读历史 | ✅偏灰 | **38 commits**（2026-09-04: 7；2026-09-05: 31）。功能拆分清晰，但存在「同一分钟多 commit」批提交痕迹 |
| 频繁小步提交 | ⚠ | 优于「1–2 个巨型 dump」；仍有批量化时间戳，通常不致 DQ，但不够「教科书增量」 |
| AI 不得包办全项目 | ⚠需诚实 | 大量 Cursor 辅助；`docs/ai-attribution.md` 有表；人类负责产品锁定、账号、live 验证 |
| Demo 视频 2–4 min、≥720p、**不加速**、真人旁白 | ❌未交付 | 这是提交硬伤；评估胜率时必须重罚直到拍完 |
| New vs reused 文档 | ✅ | README 有表 |
| 安全默认（无硬编码密钥） | ✅基本 | `.env` gitignored；评测时假设密钥未进仓 |

---

## 4. 技术架构（评委可验证路径）

```
Web (Vite) ──Pay & hunt──▶ audit-api :8787
   │                         ├ POST /audit      → Hedera x402 (402 → settle → 200)
   │                         ├ POST /audit/arc  → Arc Gateway nanopay
   │                         ├ POST /scan/*     → UI buyer proxy (仍走真实 settle)
   │                         ├ Graph client     → Studio subgraph (allowance-state / fallback)
   │                         ├ detectors        → structured links + spender registry
   │                         └ LLM synthesize   → cite-only
   └ Prove the gate → unpaid 402 decode (scheme/network/price/payTo)
```

**关键路径：**

- Hedera：`DEV_BYPASS_PAYMENT=false` → 未付款 `POST /audit` 返回 **402** → agent/UI settle → `sources.payment.rail = hedera-x402`  
- Arc：`POST /audit/arc` / UI Arc rail → `rail = arc-gateway`  
- Graph：`GRAPH_SUBGRAPH_URL=…/ether-hunt-approvals/v0.0.2` → 报告 `sources.graph.mode = allowance-state` + 可复制 GraphQL  
- Local：`/scan/local` = unpaid/`dev-bypass` — **不能**当作 partner 支付证明

**子图设计要点（Graph 赛道核心论点）：**

- 不是 16 行 Approval 日志镜像。  
- Mapping 在索引时折叠 live allowance：`unlimited` / `revoked` / peak / re-approval；维护 `Account.liveUnlimitedCount`、`Spender` 聚合。  
- 检测器读结构化字段，而不是正则吃展示文案。  
- `startBlock: 19000000`（主网 USDC，约 2024-01-13 起）。窗口外历史漏洞地址会天然空卷宗。

---

## 5. Live 状态快照（报告生成时）

| 项 | 值 |
| --- | --- |
| Subgraph v0.0.2 endpoint | `https://api.studio.thegraph.com/query/1758666/ether-hunt-approvals/v0.0.2` |
| v0.0.2 同步高度 | ~**19,071,160**（无 indexing error） |
| 参考 tip（旧版 v0.0.1 高度） | ~**24,518,423** |
| 同步缺口 | 约 **5.4M blocks** —— Case files / 近期活跃地址可能暂时空；早期窗口内地址已可扫出 `allowance-state` |
| Studio | https://thegraph.com/studio/subgraph/ether-hunt-approvals |
| 本地 audit-api | 奖项模式 `bypass=false` 可运行（开发机状态会变） |
| Git | `main` 已 push；公开可读 |

**重要：** Graph 赛道「设计与部署」已完成；**演示可重复性仍受追块约束**。评估时应：  
- 给「资格与技术深度」较高分；  
- 给「当场演示稳定性」在追平前降权。

---

## 6. 已完成 vs 未完成（诚实清单）

### 已完成（可演示 / 可验证）

- 双轨真实支付：Hedera ExactScheme + Blocky402；Arc Circle Gateway / Agent Stack  
- 402 挑战现场解码（Prove the gate）  
- Verifiable rails：结算后 PROVEN + HashScan / agent explorer 链接  
- 自建 From-Scratch 子图 + allowance-state 实体 + API 模式探测与降级  
- Cite-only LLM + 规则检测器（Permit2 / Uniswap / Morpho / Balancer / Curve 等标签）  
- Dossier UX：风险仪表、授权图、revoke 队列、PDF（Blob 打印页）、分享  
- README / prize-checklist / demo-script / AI attribution  
- Classic kickoff 合规、公开仓、38 commits

### 未完成 / 高风险缺口

1. **官方提交 demo 视频未拍**（2–4 min，不加速）—— 无视频 ≈ 无法完赛  
2. **v0.0.2 未追上 tip** —— 评委点 Case files 可能空卷宗  
3. prize-checklist 中若干「Demo clip / HashScan 截图」未勾  
4. Commit 时间戳扎堆 —— 轻微观感风险，非典型自动 DQ  
5. 品类拥挤：授权审计 / 安全扫描在黑客松里并不稀缺；原创性更多在 **付费 agent + 可验证 Graph**  
6. Dependabot 报告大量依赖告警（GitHub 提示）—— 一般不影响 partner 资格，但影响「工程严谨」观感

---

## 7. 分赛道论证（供概率校准）

### 7.1 Hedera（相对最强）

**支持高概率的事实：**

- 满足「live x402-gated + ≥1 real paid request」叙事与实现路径清晰。  
- UI 把 402 / settle / HashScan 做成可点验，适配异步评审。  
- 认真做 agentic payment 的队伍通常少于「又一个 DeFi UI」。

**压低概率的事实：**

- 未交视频；结算依赖 testnet / Blocky402 可用性。  
- 未展示 metering、A2A、ERC-8004、HCS 审计、流式支付等加分项（官方「Prefer」清单大多未做）。  
- 功能完整度偏「刚好够资格」，未必是赛道最炫。

### 7.2 The Graph From Scratch

**支持：**

- 自建子图 + 为风险语义设计的聚合 schema（相对事件镜像有技术故事）。  
- AI 强制 cite evidence；dossier 暴露 query / mode / LIVE。  
- Classic-eligible 轨道匹配。

**压低：**

- 追块未完成 → 演示不稳定。  
- 「AI + The Graph」赛道预期竞争激烈；评委可能想看更强的 AI tooling / MCP / 多子图组合。  
- 单 token（USDC）probe + 固定 startBlock —— 深度有限。  
- 早期版本曾是薄镜像（已迭代），评审若只看旧部署会误判（当前应以 v0.0.2 为准）。

### 7.3 Arc Agent Stack

**支持：**

- 真实第二条支付轨；Agent wallet + Gateway nanopay 对齐奖项文案。  
- 与 Hedera 并列的双轨证明「agentic economy」而非单链小工。

**压低：**

- 奖金池小、名额可能也少，但参赛者可能更少。  
- 集成深度可能停在「能付一次」而非丰富 agent 经济循环。  
- 同样缺视频。

### 7.4 Classic 主赛道 / Finalist

**支持：** Technicality（双协议支付 + 自建索引）尚可；Usability 有可验证 UI。  
**压低：** Originality 中等；WOW 依赖视频剪辑；品类不新；距提交日仍短但关键缺口是视频与 Graph 同步。

---

## 8. 内部参考基线（非权威，供校准）

以下为项目维护者在报告时点的**主观粗估**（第三方应独立重估，可推翻）：

| 结果 | 粗估胜率 | 备注 |
| --- | --- | --- |
| Hedera 奖（进奖池有竞争力 → 实际夺奖） | 资格几乎满分；夺奖 **18–35%** | 假设按时交合规视频 |
| Graph From Scratch 夺奖 | **8–20%**（追平后）；追平前演示 **再砍半** | 深度中等、赛道挤 |
| Arc Agent Stack 夺奖 | **12–28%** | 竞争可能更少 |
| 进 Classic Finalist 筛选 | **10–25%** | 看视频与异步材料 |
| Classic 总冠军量级 | **&lt;3%** | 不作为目标 |

若 **视频未交**：所有夺奖概率应视为 **≈0（未完赛）**，仅保留「技术资格潜力」。

---

## 9. 第三方请使用的评分表（建议）

对每条 partner 轨道打分（1–5），再映射概率：

| 维度 | 权重建议 | 评分提示 |
| --- | --- | --- |
| 资格硬门槛满足度 | 30% | live / 非 mock / ≥1 paid / from-scratch subgraph |
| 可验证性（异步） | 20% | README、402 decode、explorer 链接、可复制 query |
| 技术深度 / 原创 | 20% | 是否超越「接一下 SDK」 |
| 演示完整度 | 20% | 视频、稳定性、Case files 是否空 |
| 文档与合规 | 10% | Classic 规则、AI attribution、new vs reused |

映射示例：总分 5.0 → 夺奖潜力高；&lt;3.0 → 资格不稳或演示崩。

---

## 10. 建议第三方输出的格式模板

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

## 11. 材料链接（评测时可打开）

- Repo: https://github.com/Linus-Shyu/Ether-Hunt  
- README: 仓库根目录  
- 资格清单: `docs/prize-checklist.md`  
- Demo 脚本: `docs/demo-script.md`  
- AI 归因: `docs/ai-attribution.md`  
- Subgraph: `subgraphs/token-approvals/` · Studio `ether-hunt-approvals`  
- 本简报: `docs/win-rate-evaluation-brief.md`

---

## 12. 已知偏见与诚实声明

- 本简报由项目构建助手整理，**存在乐观偏差风险**；已单列缺口与降权因素。  
- 黑客松结果高度依赖当届对手池与评委口味，概率不可校准到精确值。  
- **未包含**最终提交包（视频、ETHGlobal 表单、现场答问）。  
- 评估时请把「能跑」和「能赢」分开：目前更接近 **能冲资格 + 有差异化**，而非 **稳拿奖**。
