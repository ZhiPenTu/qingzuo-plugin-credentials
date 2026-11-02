# AGENTS.md

本文件是 `qingzuo-plugin-credentials` 的开发指南。插件运行在轻作底座的隔离页面中，凭据的保存、加密与授权全部由底座主进程裁决。

## 项目边界

- 这里只有「凭证管理」插件：`ui/` 是页面与纯函数，`tests/` 是单元和真实宿主测试，`scripts/pack-plugin.mjs` 负责打包。
- 共享凭证库、`safeStorage` 加密、授权弹窗、`network.request/sign` 注入属于底座；不要在本仓库复刻或绕过 SDK。
- 页面永远拿不到 `secretKey`。不要把密钥写入 `localStorage`、URL、日志、错误文案或 DOM 属性。

## 硬约束

- 记录操作只能走 `credentials.records.*`；管理能力仅对市场或内置来源开放。
- 新建与替换密钥时输入框使用 `type="password"`，提交后立即清空；编辑已有记录时不得回填密钥。
- 列表显示完整 AppID，但授权面板和错误信息不得泄露密钥。
- 删除记录、撤销授权都需要用户明确操作，不做静默清理。
- 用户可见文案只说明怎么用、出了什么问题、下一步做什么。

## 目录

- `ui/records.mjs`：表单校验、排序、显示格式化与错误映射等纯函数。
- `ui/app.mjs`：页面状态、渲染和事件。
- `ui/sdk.mjs`：打包时注入的 SDK 副本，不手工维护。
- `tests/host.mjs`：以市场签名来源安装后验证真实宿主行为。

## 验证

```sh
npm test
npm run pack
QINGZUO_HOST_EXECUTABLE=/path/to/Qingzuo npm run test:host
```

改动接口时先改底座与 SDK，再同步本仓库的 vendored SDK；不要用浮动 `latest`。

## 提交与发布

- 提交信息使用 `feat:` / `fix:` / `test:` / `docs:` / `chore:`。
- 发布前确认底座 `v0.6.20` 与 `sdk-v1.7.0` 已可用，并在发布流水线设置成功的 `QINGZUO_HOST_RUN_ID`。
- `release/`、`output/`、`node_modules/` 不入库。
