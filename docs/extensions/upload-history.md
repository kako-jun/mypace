# アップロード履歴

nostr.buildにアップロードしたファイルの履歴を管理し、削除を支援する機能。

## 背景

- nostr.buildにアップロードしたファイルは削除可能だが、URLを覚えていないと削除できない
- スマホが壊れたら履歴を失う
- サーバー（D1）に保存することで、デバイスが変わっても履歴を維持

## 仕様

| 項目 | 値 |
|------|-----|
| 保存先 | Cloudflare D1 |
| 保存上限 | 100件/ユーザー |
| 対象 | 画像、動画、音声 |
| 識別子 | pubkey（公開鍵） |

## データ構造

### D1テーブル

```sql
CREATE TABLE upload_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pubkey TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  type TEXT NOT NULL,              -- 'image', 'video', 'audio'
  uploaded_at INTEGER NOT NULL,
  UNIQUE(pubkey, url)
);
```

### API

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/uploads/:pubkey` | GET | 履歴取得 |
| `/api/uploads` | POST | 履歴追加 |
| `/api/uploads` | DELETE | 履歴削除 |

## UI

### アクセス方法

- Settings → Account → Upload History →
- ImagePicker → 左下の🕐アイコン
- DrawingPicker → 左下の🕐アイコン
- VoicePicker → 左下の🕐アイコン

### 履歴一覧

```
┌─────────────────────────────────────────────────┐
│ ← BACK                                          │
├─────────────────────────────────────────────────┤
│ nostr.buildにアップロードしたファイルの履歴です。│
│ Deleteでファイルを削除できます。                 │
├─────────────────────────────────────────────────┤
│ ┌──────┐                                        │
│ │ 🖼️  │ image.jpg                              │
│ │      │ IMAGE  2024/01/15 12:34   [Copy][Delete][×]│
│ └──────┘                                        │
│ ┌──────┐                                        │
│ │ 🎵  │ voice.ogg                              │
│ │      │ AUDIO  2024/01/14 10:20   [Copy][Delete][×]│
│ └──────┘                                        │
└─────────────────────────────────────────────────┘
```

### ボタン

| ボタン | 機能 |
|--------|------|
| Copy | URLをクリップボードにコピー |
| Delete | nostr.buildからファイルを削除 |
| × | 履歴から削除（確認ダイアログあり） |

## nostr.buildからの削除

`Delete`ボタンをクリックすると、NIP-98認証を使ってnostr.buildに削除リクエストを送信する。

### 仕組み

1. URLからファイルのSHA-256ハッシュを抽出
2. NIP-98認証ヘッダーを生成（NIP-07拡張不要）
3. nostr.buildの削除APIにDELETEリクエスト
4. 成功したら履歴からも自動削除

### 注意事項

- **無料アカウントでも削除可能**（2025年12月確認）
- 削除後もCDNキャッシュにより数分〜数時間画像が表示される場合がある
- 実際のファイルは削除済みで、キャッシュが切れれば消える

## 履歴からの削除

`×`ボタンをクリックすると確認ダイアログが表示される:

```
┌─────────────────────────────────────────────────┐
│ このURLを履歴から削除すると、nostr.buildから    │
│ ファイルを削除するための情報を失います。         │
│                                                 │
│ 本当に削除しますか？                             │
│                                                 │
│                     [ Cancel ]  [ Remove ]      │
└─────────────────────────────────────────────────┘
```

**警告**: 履歴から削除すると、nostr.buildからファイルを削除する手段を失う可能性がある。

## 対象ファイル

以下のアップロードが自動的に履歴に保存される:

1. **画像添付** - Row2の画像ボタン
2. **ステッカー画像** - ローカルファイルからのステッカー
3. **お絵かき** - Drawing機能
4. **ボイスメモ** - Voice機能

## 技術実装

### アップロード時の保存

```typescript
import { saveUploadToHistory } from '../lib/api'
import { getCurrentPubkey } from '../lib/nostr/events'

// アップロード成功後
const pubkey = await getCurrentPubkey()
saveUploadToHistory(pubkey, result.url, file.name, 'image')
```

### 履歴取得

```typescript
const pubkey = await getCurrentPubkey()
const uploads = await fetchUploadHistory(pubkey)
```

## プライバシー

- pubkeyで識別するため、秘密鍵（nsec）は不要
- 同じpubkeyを持つユーザーのみ履歴にアクセス可能
- D1に保存されるのはURL、ファイル名、種類、日時のみ
