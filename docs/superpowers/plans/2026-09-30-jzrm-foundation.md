# JZRM 初版桌面应用 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可启动的 Mac 桌面应用，在独立作品内完成资料组织、写作、AI 提案、审校、剧本杀改编、文风与垃圾箱的首条可用链路。

**Architecture:** Electron 主进程持有本地数据、密钥、文件与模型调用；React 渲染进程通过受限 IPC 使用这些能力。所有作品实体共用可恢复删除协议，AI 只返回提案，应用由用户确认。

**Tech Stack:** Electron、React、TypeScript、Vite、Vitest、原生 JSON 文件原子写入、safeStorage、DOCX/PDF 导出。

**Spec:** `/Users/alex/Documents/JZRM/docs/superpowers/specs/2026-09-30-jzrm-design.md`

## Global Constraints

- 项目独立于 ALEX Brain Core；用户正文和源码不得写入规则库。
- 五个工作区分别有可直达的独立页面。
- 所有用户创建的持久对象可软删除、分类找回、确认后永久删除。
- 未配置模型时所有手动编辑功能可用；AI 输出不得直接覆盖正文。
- API 密钥不进入项目数据文件与渲染进程。

## Review Focus

- 父级作品或卷删除时子级是否完整保留并能恢复。
- 两部作品切换后是否会串用正文、设定或 AI 上下文。
- 极短正文是否错误地产生综合分。
- 模型调用失败后原文是否仍在。
- 导出、恢复与重名对象是否能安全处理。

---

### Task 1: 安全桌面壳与导航

**Files:** `package.json`, `vite.config.ts`, `electron/main.cjs`, `electron/preload.cjs`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `index.html`。

**Interfaces:** `window.jzrm` 只暴露明列的 IPC 方法；`App` 以 `route`、`workId` 渲染独立页面。

- [ ] 写导航测试：每个一级入口与五个作品页都有独立路由。
- [ ] 运行测试看到缺少路由实现的失败。
- [ ] 建 Electron + Vite 应用壳，主进程启用 contextIsolation 与受限导航。
- [ ] 测试通过，手动确认五个页面可以直接打开与返回。

### Task 2: 作品数据与分类垃圾箱

**Files:** `src/domain.ts`, `src/store.ts`, `tests/store.test.ts`, `electron/main.cjs`。

**Interfaces:** `createEntity(state, input)`, `updateEntity(state,id,patch)`, `moveToTrash(state,id)`, `restoreEntity(state,id)`, `purgeEntity(state,id)` 返回新状态；IPC 读写状态。

- [ ] 写失败测试：作品隔离、父子级联删除与恢复、分类筛选、重名恢复、永久删除。
- [ ] 实现状态迁移函数和主进程原子写入。
- [ ] 运行全套测试，确认跨作品内容隔离。

### Task 3: 作品分级页、资料与正文

**Files:** `src/App.tsx`, `src/components/Workspace.tsx`, `src/components/EntityEditor.tsx`, `src/styles.css`, `tests/routes.test.ts`。

**Interfaces:** 五个页面通过 `work/:id/{outline,settings,memory,fine-outline,body}` 路由；作品内分类页使用实体类型筛选。

- [ ] 写失败测试覆盖五个路由与设定分类映射。
- [ ] 实现首页、作品库、阅读、灵感、拆解、写作、资料、垃圾箱等页面及通用 CRUD。
- [ ] 运行测试并在桌面窗口验证新建作品、章节、删除、恢复。

### Task 4: AI 适配、审校与润笔提案

**Files:** `electron/ai.cjs`, `src/ai-prompts.ts`, `src/components/AiPanel.tsx`, `src/components/ReviewPage.tsx`, `tests/review.test.ts`。

**Interfaces:** `runAiTask(config,task)` 返回文本/结构化结果；`reviewEligibility(text)` 决定评分可用性；`window.jzrm.ai.run` 调用主进程。

- [ ] 写失败测试：短文材料不足、七维字段、三案提案不改原文。
- [ ] 实现供应商配置、Keychain 加密密钥、连接测试与 AI 任务。
- [ ] 实现整篇/局部审校、三案替换、润笔、Skill 选择和版本预览。
- [ ] 运行测试并验证无密钥错误与成功模型请求的反馈。

### Task 5: 改编、Agent、文风与流程

**Files:** `src/components/AdaptationPage.tsx`, `src/components/AgentsPage.tsx`, `src/components/WorkflowPage.tsx`, `src/components/StylePage.tsx`, `tests/adaptation.test.ts`。

**Interfaces:** 改编章按事件时间线与角色知情范围生成；Agent 配置是同一数据源；流程节点指向真实页面。

- [ ] 写失败测试：第二人称、角色信息隔离、时间线对齐、流程页面目标。
- [ ] 实现手动结构化编辑与 AI 生成提案入口；全局助手/脑暴弹窗。
- [ ] 实现拆解报告到文风包、六个预设包和仓库卡片。
- [ ] 运行测试，检查流程节点跳转与可编辑内容可删除。

### Task 6: 导入导出与 Mac 构建

**Files:** `electron/files.cjs`, `electron/main.cjs`, `package.json`, `README.md`, `tests/export.test.ts`。

**Interfaces:** TXT/DOCX/PDF 导出；TXT/MD/DOCX/可提取 PDF 导入；构建 `.app`。

- [ ] 写失败测试：空作品导出、中文正文导出、删除对象被排除。
- [ ] 实现导入导出、备份恢复和本机打包脚本。
- [ ] 运行测试、类型检查、前端构建、Electron 启动与 Mac 打包。
