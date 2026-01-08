# 設定エクスポート/インポート

複数デバイス間で設定を同期するための機能。

## 機能

### エクスポート

「Export」ボタンで `mypace-settings.json` をダウンロード。

### インポート

「Import」でJSONファイルを選択して設定を復元。

## エクスポート形式（v3）

```json
{
  "mypace_settings": {
    "version": 3,
    "theme": {
      "mode": "dark",
      "colors": {
        "topLeft": "#ff6b6b",
        "topRight": "#4ecdc4",
        "bottomLeft": "#45b7d1",
        "bottomRight": "#96ceb4"
      }
    },
    "filters": {
      "showSNS": true,
      "showBlog": true,
      "mypace": true,
      "ngWords": ["spam"],
      "ngTags": ["ad"],
      "lang": "ja",
      "hideAds": true,
      "hideNSFW": true,
      "hideNPC": false,
      "presets": [
        {
          "id": "preset-123",
          "name": "My Preset",
          "filters": {
            "showSNS": true,
            "showBlog": true,
            "mypace": true,
            "ngWords": ["spam"],
            "ngTags": ["ad"],
            "lang": "ja",
            "hideAds": true,
            "hideNSFW": true,
            "hideNPC": false
          }
        }
      ],
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

## 含まれる設定

| 設定 | 説明 |
|------|------|
| theme.mode | アプリテーマ（light / dark） |
| theme.colors | 4隅のグラデーション色 |
| filters.* | フィルタ設定（ngWords, ngTags, lang等） |
| filters.presets | フィルタプリセット一覧 |
| filters.muteList | ミュートリスト（npub/pubkey/追加日時） |

## 含まれない設定

| 設定 | 理由 |
|------|------|
| 秘密鍵（nsec） | セキュリティ上の理由 |
| プロフィールキャッシュ | 一時データ |
| 下書き・エディタ設定 | デバイス固有 |

## バージョン履歴

| バージョン | 変更内容 |
|------------|----------|
| v1 | テーマ設定のみ |
| v2 | フィルタプリセット、ミュートリストを追加 |
| v3 | フィルタ設定本体を追加、localStorage構造を統合 |

## 使用シナリオ

### PC → スマホ

1. PCで設定画面を開く
2. 「ファイルで保存」でJSONをダウンロード
3. クラウドストレージやメッセージアプリでスマホに送信
4. スマホで「ファイルから読み込み」

### バックアップ

1. 「ファイルで保存」でJSONをダウンロード
2. 安全な場所に保管
3. 必要時に「ファイルから読み込み」で復元

## 色メニュー

4隅の色ピッカー横にある ⋮ ボタンで以下の操作が可能:

- **HEX入力**: 16進カラーコードを直接編集
- **コピー**: この隅の色をコピー
- **ペースト**: コピーした色を適用
- **全隅に適用**: この色を4隅すべてに適用
