# websites（複数サイトURL）

プロフィールに複数のWebサイトURLを登録できる機能。
Kind 0（プロフィール）のcontentに`websites`フィールドを追加する。

## 背景

- Nostr標準のKind 0では`website`フィールドは単一URLのみ
- 現実のユーザーはGitHub、Twitter、YouTube等、複数のサイトを持っている
- サービスごとにリンクを整理して表示したい

## データ形式

Kind 0（プロフィール）のcontentに`websites`配列を追加:

```json
{
  "name": "username",
  "website": "https://example.com",
  "websites": [
    {
      "url": "https://github.com/username",
      "label": "GitHub"
    },
    {
      "url": "https://twitter.com/username",
      "label": "Twitter"
    },
    {
      "url": "https://youtube.com/@username",
      "label": "YouTube"
    }
  ]
}
```

### フィールド

| フィールド | 型 | 必須 | 説明 |
|------------|------|------|------|
| `url` | string | Yes | WebサイトのURL |
| `label` | string | No | サービス名（自動検出可能） |

## 互換性

### 他のNostrクライアント

| クライアント | 表示 |
|-------------|------|
| MyPace | 全ての`websites`を表示 |
| 他のクライアント | `website`のみ表示（`websites`は無視） |

互換性のため、`websites[0].url`を`website`フィールドにも設定する。

### フォールバック

1. `websites`配列があれば全て表示
2. なければ`website`単体を表示
3. 両方なければ表示なし

## ラベル自動検出

URLからサービス名を自動判定:

| URL含む文字列 | ラベル |
|--------------|--------|
| `github.com` | GitHub |
| `twitter.com`, `x.com` | Twitter |
| `youtube.com`, `youtu.be` | YouTube |
| `instagram.com` | Instagram |
| `linkedin.com` | LinkedIn |
| `facebook.com` | Facebook |
| `qiita.com` | Qiita |
| `zenn.dev` | Zenn |
| `note.com` | note |
| `bsky.app` | Bluesky |
| `twitch.tv` | Twitch |
| `discord.gg`, `discord.com` | Discord |
| `reddit.com` | Reddit |
| `medium.com` | Medium |
| `substack.com` | Substack |
| その他 | Website |

## アイコン表示

サービスに応じたアイコンを表示:

| サービス | アイコン |
|---------|---------|
| GitHub | Github |
| Twitter | Twitter |
| YouTube | Youtube |
| Instagram | Instagram |
| LinkedIn | Linkedin |
| Facebook | Facebook |
| Twitch | Twitch |
| Discord | MessageCircle |
| Reddit | MessageSquare |
| その他 | Globe |

## UI仕様

### 編集画面

複数URLの入力フィールドを動的に追加・削除:

```
┌─ Websites ─────────────────────────────────┐
│ [https://example.com    ] [Website   ] [×] │
│ [https://github.com/user] [GitHub    ] [×] │
│ [https://twitter.com/usr] [Twitter   ] [×] │
│ [+ Add URL]                                │
└────────────────────────────────────────────┘
```

- URLを入力するとラベルが自動検出される
- ラベルは手動で変更可能
- 最大10件まで登録可能

### 表示画面

サービスアイコン付きでリンクを表示:

```
🐙 GitHub
🐦 Twitter
📺 YouTube
🌐 example.com
```

## 制限

- 最大URL数: 10個
- URL長さ: 標準的なURL長制限
- ラベル長さ: 自由（UIの都合で20文字程度推奨）

## 実装詳細

### プロフィール読み込み

```typescript
interface WebsiteEntry {
  url: string
  label?: string
}

interface Profile {
  website?: string      // 互換性用
  websites?: WebsiteEntry[]  // MyPace拡張
  // ...
}

function getWebsites(profile: Profile): ResolvedWebsite[] {
  if (profile.websites && profile.websites.length > 0) {
    return profile.websites.map(w => ({
      url: w.url,
      label: w.label || detectServiceLabel(w.url)
    }))
  }
  if (profile.website) {
    return [{ url: profile.website, label: detectServiceLabel(profile.website) }]
  }
  return []
}
```

### プロフィール保存

```typescript
function saveProfile(profile: Profile) {
  const websites = profile.websites || []

  // 互換性のため、最初のURLをwebsiteにも設定
  const newProfile = {
    ...profile,
    website: websites[0]?.url || profile.website || undefined,
    websites: websites.length > 0 ? websites : undefined
  }

  // Kind 0イベントとして署名・送信
}
```
