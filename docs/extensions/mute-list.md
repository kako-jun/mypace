# Mute List（ミュートリスト）

特定ユーザーの投稿を非表示にするクライアントサイドフィルタ機能。

## 概要

- **Nostr標準準拠**: NIP-51のミュートリスト概念に沿った命名
- **クライアントサイド処理**: プライバシー保護のためサーバーに送信しない
- **npub形式**: ユーザーが管理しやすい形式で保存

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

```typescript
// Timeline.tsx
const mutedPubkeys = getMutedPubkeys()
filteredItems = items.filter(item =>
  !mutedPubkeys.includes(item.event.pubkey)
)
```

- イベントの`pubkey`フィールド（hex形式）でマッチング
- リポストの場合は元投稿者もチェック

### イベント通知

ミュートリスト変更時にカスタムイベントを発火:

```typescript
window.dispatchEvent(new CustomEvent('mypace:muteListChanged'))
```

これによりTimelineがリアルタイムで更新される。

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

- ミュートリストはローカルストレージにのみ保存
- APIリクエストにミュート情報を含めない
- サーバーサイドでミュート対象を知ることはできない

## 関連

- [Filter Presets](./filter-presets.md) - フィルタ設定の保存
- [Smart Filter](./smart-filter.md) - 広告/NSFWのサーバーサイドフィルタ
- [設定エクスポート](./settings-export.md) - 設定の保存・復元
