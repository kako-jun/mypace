# Webhook API

外部ツールやスクリプトからMY PACE経由でNostrに投稿するためのAPI。

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
  "id": "<イベントID>"
}
```

### 失敗時

```json
{
  "error": "Invalid event: missing id or sig"
}
```

署名検証失敗時:

```json
{
  "error": "Invalid event signature"
}
```

レート制限時（HTTP 429）:

```json
{
  "error": "Too many requests. Please wait before posting again.",
  "error_code": "rate_limited"
}
```

重複投稿時（HTTP 429）:

```json
{
  "error": "Duplicate post detected. Please wait before posting similar content.",
  "error_code": "duplicate_content"
}
```

## 重要事項

- **署名検証あり**: サーバーは`verifyEvent()`でNostrイベントの署名を検証する。無効な署名は401で拒否される
- **D1記録のみ**: このエンドポイントはイベントをD1データベースに記録するのみ。リレーへの送信はブラウザから直接行う
- **副作用**: 投稿の記録に加えて、通し番号の付与、通知の記録、Supernovaのチェック、ステラの記録などの副作用処理が行われる

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

## MY PACE独自タグの追加

投稿にMY PACE機能を付与する場合は、署名前にタグを追加:

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
  content: '最初の280文字...\n\n...READ MORE → https://mypace.llll-ll.com/user/npub...'
}, sk)
```

## 制限事項

- **レート制限**: kind:1 + #mypace タグ付き投稿に対して、同一 pubkey から10秒以内の連投をブロック（429）
- **重複検出**: 同一pubkey + 同一内容（先頭100文字のSHA-256ハッシュで判定）の投稿を60秒以内にブロック（429）
- イベントサイズ: リレーの制限に依存（通常64KB以下）
