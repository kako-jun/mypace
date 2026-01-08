# Mute List（ミュートリスト）

特定ユーザーの投稿を非表示にするフィルタ機能。

## 概要

- **Nostr標準準拠**: NIP-51のミュートリスト概念に沿った命名
- **サーバーサイド処理**: APIリクエスト時にパラメータとして送信、サーバー側でフィルタ
- **npub形式**: ユーザーが管理しやすい形式で保存
- **ブラウザURL非公開**: 共有URLにはミュート情報が含まれない

## 使い方

### ミュートに追加

1. ヘッダーのフィルタボタンをクリック
2. 「Mute List」ボタンをクリック
3. npubアドレスを入力してEnterまたは「Add」

### ミュート解除

1. Mute Listポップアップを開く
2. 解除したいエントリの × ボタンをクリック

### 設定画面からのアクセス

設定 → 「Edit Filters →」リンクからフィルタパネルを開ける。

## 技術仕様

### ストレージ

```typescript
interface MuteEntry {
  npub: string    // 表示用（npub1...）
  pubkey: string  // マッチング用（hex）
  addedAt: number // 追加日時
}
```

localStorage キー: `mypace_mute_list`

### フィルタリング処理

フィルタリングはAPIサーバー側で実行される:

```typescript
// apps/api/src/routes/timeline.ts
const muteParam = c.req.query('mute') || ''
const mutedPubkeys = muteParam ? muteParam.split(',') : []

// フィルタ適用
events = events.filter(e => !mutedPubkeys.includes(e.pubkey))
```

- イベントの`pubkey`フィールド（hex形式）でマッチング
- APIから返却前に除外されるため、ページネーションが正しく動作

### 適用タイミング

ミュートリストは他のフィルタ設定と同様、FilterPanelの「Save」ボタンで適用:

- localStorageに保存
- 次回のAPIリクエストから反映
- 即時適用（Save前のプレビュー）は非対応

## 設定エクスポート

ミュートリストは設定エクスポートに含まれる（v2以降）:

```json
{
  "mypace_settings": {
    "version": 2,
    "filters": {
      "muteList": [
        {
          "npub": "npub1...",
          "pubkey": "hex...",
          "addedAt": 1234567890
        }
      ]
    }
  }
}
```

## プライバシー考慮

- ミュートリストはローカルストレージに保存
- APIリクエストにはパラメータとして送信（フィルタ処理のため）
- **ブラウザURLには含まれない**（共有時に漏れない）
- サーバーログに残る可能性があるが、ユーザー間で共有されることはない

## 関連

- [Filter Presets](./filter-presets.md) - フィルタ設定の保存
- [Smart Filter](./smart-filter.md) - 広告/NSFWのサーバーサイドフィルタ
- [設定エクスポート](./settings-export.md) - 設定の保存・復元
