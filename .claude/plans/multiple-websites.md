# 複数サイトURL登録機能計画

## 概要

ユーザープロフィールに複数のWebサイトURLを登録できる機能。

## 背景

### Nostr標準（Kind 0）
```json
{
  "name": "username",
  "website": "https://example.com"  // 単一のみ
}
```

### 現実のニーズ
- GitHub
- Twitter/X
- ブログ
- ポートフォリオ
- YouTube
- など複数持っている人が多い

## 実装方針

### データ構造

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

### 互換性

| クライアント | 表示 |
|-------------|------|
| mypace | 全てのURL表示 |
| 他のクライアント | `website` のみ表示（`websites` は無視） |

### フォールバック

1. `websites` 配列があれば全て表示
2. なければ `website` 単体を表示
3. 両方なければ表示なし

## プロフィール編集UI

```
┌─ プロフィール編集 ─────────────────────┐
│                                        │
│ 名前: [username        ]               │
│                                        │
│ サイトURL:                              │
│ ┌────────────────────────────────────┐ │
│ │ [https://example.com    ] [メイン]  │ │
│ │ [https://github.com/user] [GitHub] │ │
│ │ [https://twitter.com/usr] [Twitter]│ │
│ │ [＋ URLを追加]                      │ │
│ └────────────────────────────────────┘ │
│                                        │
│                           [保存]       │
└────────────────────────────────────────┘
```

### ラベル自動検出

URLからサービスを自動判定:
```typescript
function detectServiceLabel(url: string): string {
  if (url.includes('github.com')) return 'GitHub'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter'
  if (url.includes('youtube.com')) return 'YouTube'
  if (url.includes('instagram.com')) return 'Instagram'
  if (url.includes('linkedin.com')) return 'LinkedIn'
  if (url.includes('facebook.com')) return 'Facebook'
  if (url.includes('qiita.com')) return 'Qiita'
  if (url.includes('zenn.dev')) return 'Zenn'
  if (url.includes('note.com')) return 'note'
  return 'Website'
}
```

## プロフィール表示UI

```
┌─ プロフィール ──────────────────────────┐
│                                        │
│ [アバター] @username                   │
│                                        │
│ 自己紹介テキスト...                     │
│                                        │
│ 🔗 Links:                              │
│   🌐 example.com                       │
│   🐙 GitHub                            │
│   🐦 Twitter                           │
│   📺 YouTube                           │
│                                        │
└────────────────────────────────────────┘
```

### サービスアイコン

| サービス | アイコン |
|---------|---------|
| Website | 🌐 |
| GitHub | 🐙 / アイコン |
| Twitter | 🐦 / アイコン |
| YouTube | 📺 |
| Instagram | 📷 |
| その他 | 🔗 |

## 実装

### プロフィール読み込み

```typescript
interface Profile {
  name?: string
  website?: string
  websites?: Array<{
    url: string
    label?: string
  }>
  // ... 他のフィールド
}

function getWebsites(profile: Profile): Array<{url: string, label: string}> {
  if (profile.websites && profile.websites.length > 0) {
    return profile.websites.map(w => ({
      url: w.url,
      label: w.label || detectServiceLabel(w.url)
    }))
  }
  if (profile.website) {
    return [{
      url: profile.website,
      label: detectServiceLabel(profile.website)
    }]
  }
  return []
}
```

### プロフィール保存

```typescript
function saveProfile(profile: Profile) {
  const websites = profile.websites || []

  // 互換性のため、最初のURLをwebsiteにも設定
  const mainWebsite = websites[0]?.url || profile.website || ''

  const profileContent = {
    ...profile,
    website: mainWebsite,
    websites: websites
  }

  // Kind 0 イベントとして署名・送信
}
```

## 制限

- 最大URL数: 10個程度（UIの都合）
- URL長さ: 標準的なURL長制限
- ラベル長さ: 20文字程度

## 実装優先度

1. プロフィール読み込み対応（`websites` フィールド）
2. プロフィール表示UI（複数リンク表示）
3. プロフィール編集UI（複数URL入力）
4. ラベル自動検出
5. サービスアイコン表示
