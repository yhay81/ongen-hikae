# 音源控え

制作物で使った音源の配布元、確認日、利用条件、クレジット表記を案件ごとに端末内で整理する日本語Webツールです。

- 本番: https://ongen-hikae.yhay81.com
- 構成: Cloudflare Workers / D1、Hono / Hono JSX、Vite+、TypeScript
- データ境界: 控えの中身はlocalStorageだけに保存し、サーバーや匿名イベントへ送りません。
- 製品境界: 音声の保存、利用許可・権利状態の判定、法的助言は行いません。

## 開発

```powershell
npm install
npm run check
npm test
npm run build
```

公開前は npm run release:check を通し、D1の自動QA行を実利用から分離します。
