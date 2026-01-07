# Dynamic OGP (作業中)

投稿ページ・ユーザーページの動的OGP生成機能。

## 現状

**動作していない**。クローラーがアクセスしてもホームのOGPが返される。

## 実装

### Cloudflare Pages Functions

`apps/web/functions/` にFunctionsを配置：

```
functions/
  lib/ogp-template.ts  # HTML生成
  post/[id].ts         # 投稿ページOGP
  user/[npub].ts       # ユーザーページOGP
  package.json         # nostr-tools依存関係
```

### クローラー検出パターン

```typescript
/bot|crawler|spider|slurp|archiver|facebookexternalhit|twitterbot|linkedinbot|whatsapp|slack|discord|telegram|line|skype|viber|kakao|preview|fetch|embed|card|link|meta|curl|wget|http|url/i
```

## Cloudflare設定の変更

### ビルドコマンド

変更前：
```
pnpm install && pnpm -C apps/web build
```

変更後：
```
pnpm install && pnpm -C apps/web build && cp -r apps/web/functions . && npm install --prefix functions
```

### wrangler.toml

プロジェクトルートに `wrangler.toml` を追加：

```toml
name = "mypace"
compatibility_date = "2024-01-01"
pages_build_output_dir = "apps/web/dist"
```

### 出力ディレクトリ

ダッシュボードでは `dist` のまま（変更不可）。`wrangler.toml` で `apps/web/dist` を指定。

## 試したこと

1. **wrangler.tomlをルートに配置** → Cloudflareがファイルを認識し、`pages_build_output_dir` を読み込むようになった

2. **ビルドコマンドでfunctionsをコピー** → `cp -r apps/web/functions .` でルートにコピー

3. **functions/package.json追加** → `nostr-tools` の依存関係エラーを解決

4. **クローラー検出パターン拡張** → より多くのUser-Agentを検出するように

## 問題点

- ローカルのcurlでは正しいOGPが返される
- 外部のOGP確認ツール（WebFetch含む）ではホームのOGPが返される
- 原因不明

## 次のステップ

- [ ] ビルド完了後に再テスト
- [ ] 動作しない場合、Cloudflare Workersルートでの実装を検討
- [ ] または、mypace-apiでOGP生成を行う方法を検討

## 関連

- [seo.md](../seo.md) - SEO全体の設計
- [share.md](./share.md) - シェアメニュー
