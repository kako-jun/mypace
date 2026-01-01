# SEO & OGP

## Overview

MY PACEはSEO最適化とソーシャルメディア共有のために、以下の対応を実施しています。

## Static SEO

すべてのページで共通のSEOメタタグを設定（`apps/web/index.html`）:

- **OGP (Open Graph Protocol)**: Facebook、LinkedIn等
- **Twitter Card**: X(Twitter)専用
- **基本メタタグ**: description, keywords, canonical
- **robots.txt**: クローラー制御
- **sitemap.xml**: サイトマップ

## Dynamic OGP

ユーザーページと投稿ページでは、**Cloudflare Pages Functions**を使用してページごとに異なるOGPカードを生成します。

### 実装

#### ディレクトリ構造

```
apps/web/functions/
  lib/
    ogp-template.ts    # HTML生成ユーティリティ
  user/
    [npub].ts          # ユーザーページOGP
  post/
    [id].ts            # 投稿ページOGP
  tsconfig.json
```

#### ユーザーページ (`/user/[npub]`)

**生成されるOGP:**
- **Title**: `{displayName} - MY PACE`
- **Description**: プロフィールの自己紹介（200文字まで）
- **Image**: プロフィール画像 or バナー画像
- **Type**: `profile`

**データソース:**
- `/api/profiles?pubkeys={pubkey}` からプロフィール取得
- npubをhex pubkeyにデコードして使用

#### 投稿ページ (`/post/[id]`)

**生成されるOGP:**
- **Title**: `{displayName}の投稿 - MY PACE`
- **Description**: 投稿本文（200文字まで、URL・メンション除去）
- **Image**: 投稿内の画像 or 投稿者のプロフィール画像
- **Type**: `article`

**データソース:**
- `/api/events/{id}` からイベント取得
- `/api/profiles?pubkeys={pubkey}` から投稿者プロフィール取得

### クローラー検出

User-Agentを検出して、クローラーの場合のみサーバーサイドでHTMLを生成:

```typescript
const isCrawler = /bot|crawler|spider|slurp|archiver|facebookexternalhit|twitterbot|linkedinbot|whatsapp/i.test(userAgent)
```

**検出対象:**
- Googlebot, Bingbot等の検索エンジン
- Facebookexternalhit (Facebook)
- Twitterbot (X/Twitter)
- LinkedInBot
- WhatsApp等のメッセージアプリ

**通常アクセス:**
- `context.next()` でSPAにフォールスルー
- React Routerが通常通りルーティング

### キャッシュ戦略

```http
Cache-Control: public, max-age=300
```

- **5分間のHTTPキャッシュ**: Cloudflare Edgeでキャッシュ
- プロフィール・投稿の更新を適度に反映
- クローラーのアクセス負荷を軽減

### エラーハンドリング

以下の場合はSPAにフォールバック:
- npub/イベントIDのデコード失敗
- API通信エラー
- データ未取得
- 予期しない例外

### テキスト処理

**extractPlainText:**
- Nostr参照（nostr:npub, nostr:note等）を除去
- URLを除去
- ハッシュタグを除去
- 空白を正規化

**truncate:**
- 指定文字数で切り詰め
- 末尾に `...` を追加

**escapeHtml:**
- XSS対策のためHTMLエスケープ
- `&`, `<`, `>`, `"`, `'` を変換

## デプロイ

Cloudflare Pages Functionsは自動的にデプロイされます:

```bash
pnpm deploy
# または
pnpm -C apps/web deploy
```

## 検証

OGPカードの確認:
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

## 制限事項

- **kind 1のみ対応**: 投稿ページはテキストノート（kind 1）のみ
- **画像検出**: 投稿内の画像はシンプルな正規表現で検出（`.jpg|.jpeg|.png|.gif|.webp`）
- **リアルタイム性**: 5分間のキャッシュにより、即座の反映はされない
