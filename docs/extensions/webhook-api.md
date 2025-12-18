# Webhook API

外部ツールやスクリプトからMyPace経由でNostrに投稿するためのAPI。

## エンドポイント

```
POST https://mypace-api.llll-ll.workers.dev/api/publish
Content-Type: application/json
```

## リクエスト形式

```json
{
  "event": {
    "id": "<イベントID（ハッシュ）>",
    "pubkey": "<公開鍵>",
    "created_at": <UNIXタイムスタンプ>,
    "kind": 1,
    "tags": [
      ["t", "mypace"],
      ["client", "mypace"]
    ],
    "content": "<投稿内容>",
    "sig": "<署名>"
  }
}
```

## レスポンス

### 成功時

```json
{
  "success": true,
  "id": "<イベントID>",
  "relays": {
    "total": 5,
    "success": 4,
    "details": [
      { "relay": "wss://relay.damus.io", "success": true, "error": null },
      { "relay": "wss://nos.lol", "success": true, "error": null }
    ]
  }
}
```

### 失敗時

```json
{
  "error": "Invalid event: missing id or sig"
}
```

## 重要事項

- **署名必須**: サーバーは署名検証を行わない（リレーが行う）が、署名なしのイベントはリレーに拒否される
- **サーバーは透過的**: イベントを一切加工せず、そのままリレーに転送
- **認証不要**: 署名済みイベントの正当性はNostrプロトコルが担保

## 使用例

### JavaScript (nostr-tools)

```javascript
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools'

const sk = generateSecretKey()  // または既存の秘密鍵
const event = finalizeEvent({
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ['t', 'mypace'],
    ['client', 'mypace']
  ],
  content: 'Hello from webhook!'
}, sk)

const response = await fetch('https://mypace-api.llll-ll.workers.dev/api/publish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event })
})

console.log(await response.json())
```

### Python (python-nostr)

```python
import json
import time
import requests
from nostr.event import Event
from nostr.key import PrivateKey

private_key = PrivateKey()  # または既存の秘密鍵

event = Event(
    kind=1,
    content="Hello from webhook!",
    tags=[["t", "mypace"], ["client", "mypace"]],
    created_at=int(time.time())
)
event.sign(private_key.hex())

response = requests.post(
    'https://mypace-api.llll-ll.workers.dev/api/publish',
    json={'event': event.to_dict()}
)

print(response.json())
```

### curl

```bash
# 事前に署名済みイベントJSONを作成しておく
curl -X POST https://mypace-api.llll-ll.workers.dev/api/publish \
  -H "Content-Type: application/json" \
  -d @signed_event.json
```

## MyPace独自タグの追加

投稿にMyPace機能を付与する場合は、署名前にタグを追加:

```javascript
const event = finalizeEvent({
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ['t', 'mypace'],
    ['client', 'mypace'],
    // aurora: テーマカラー（オプション）
    ['aurora', '#1a1a2e', '#16213e', '#0f3460', '#e94560'],
    // teaser: 長文フォールド（オプション、280文字超の場合）
    ['teaser', '281文字目以降の本文']
  ],
  content: '最初の280文字...\n\n...READ MORE → https://mypace.llll-ll.com/profile/npub...'
}, sk)
```

## 接続先リレー

APIは以下のリレーに投稿を配信:

- wss://relay.damus.io
- wss://nos.lol
- wss://relay.nostr.band
- wss://nostr.wine
- wss://relay.snort.social

## 制限事項

- レート制限: 現在なし（将来追加の可能性）
- イベントサイズ: リレーの制限に依存（通常64KB以下）
