# 凭证管理（轻作插件）

集中保存各工具需要的 `AppID` 与 `APP_SecretKey`，按需授权给其他轻作工具使用。密钥只留在底座主进程，插件页面既看不到也读不回来。

## 功能

- 保存多组凭证，支持生产与沙箱环境、别名和更新时间。
- 新建后只显示完整 AppID；密钥只在新建时写入，编辑时只能整体替换，不会回填。
- 查看每条凭证被哪些工具引用，并随时撤销授权。
- 删除凭证会同时删除密钥和全部授权。
- 支持浅色、深色和窄窗口。

## 安装

在轻作「工具中心」安装市场版 `official.credentials`。本地导入的未签名版本可以打开，但底座只允许市场来源的插件管理共享凭证。

## 开发

```sh
npm install
npm test
npm run pack
QINGZUO_HOST_EXECUTABLE=/path/to/Qingzuo npm run test:host
```

`npm run pack` 生成双平台各自的 `.ecplugin` 与 `catalog-<platform>.json`；发布流水线在两个平台分别构建并上传到同一个 GitHub Release。

## 安全边界

- 插件通过 `credentials.records` 管理记录，底座返回的数据永远不包含 `secretKey`。
- 记录元数据保存在 `userData/credential-records.json`，密钥保存在系统凭据存储，并以 `enc:v1:` 信封加密。
- 消费方必须声明 `permissions.credentialVault: 'use'`，并由用户在底座弹窗中逐条确认授权。
- 卸载消费方或删除记录会立即清理对应授权。

接口与权限说明见 [docs/credential-vault.md](https://github.com/ZhiPenTu/qingzuo-desktop/blob/main/docs/credential-vault.md)。

## 许可

MIT
