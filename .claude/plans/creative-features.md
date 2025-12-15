# クリエイティブ機能計画

## 概要

mypaceを「遊びSNS」として差別化するための機能。
テキスト以外の表現手段を追加し、カジュアルで個性的な投稿を可能にする。

## 機能案

### 1. ボイスメモ機能

**コンセプト:**
- 押している間だけ録音（LINE/WhatsApp風）
- 短い音声 = 個性的、気軽
- 長文を書くのが苦手な人も投稿しやすい

**実装:**
- MediaRecorder API で録音
- 最大録音時間: 10-30秒程度（検討）
- nostr.buildにアップロード → URLを投稿に含める
- タイムラインで音声プレーヤーとして表示

**UI案:**
- マイクボタンを押し続けて録音
- 離すと録音終了
- プレビュー再生 → 投稿 or キャンセル

### 2. お絵かき機能（Splatoon風）

**コンセプト:**
- 白地に黒線のみのシンプルな絵
- 制約があるから味が出る
- 絵が下手でも「味」になる
- エディタ内蔵でそのまま投稿

**実装:**
- Canvas API でお絵かきエディタ
- ツール: ペン、消しゴム、全消去のみ
- 線の太さ: 2-3種類
- 完成したら PNG化 → nostr.buildアップロード → URL投稿

**UI案:**
- 投稿フォームに「お絵かき」ボタン
- モーダルでキャンバス表示
- 描き終わったら「投稿に添付」

## 重要な注意点

### 削除不可の原則

**nostr.buildの特性:**
- アップロードしたファイルは削除できない
- Nostrの削除リクエスト（Kind 5）は外部ホスティングには効かない
- 一度投稿したら永久に残る

**ユーザーへの警告:**
- 音声録音前に「削除できません」と明示
- お絵かき投稿前にも同様の警告
- 初回利用時に説明ダイアログ

**これを機能として捉える:**
- 「消せないからこそ価値がある」という考え方
- デジタルタトゥーではなく「デジタル足跡」
- 後から見返す楽しみ

## 差別化ポイント

| 他のNostrクライアント | mypace |
|----------------------|--------|
| テキスト重視 | マルチメディア |
| 硬い雰囲気 | 遊び心 |
| Twitter的 | 独自路線 |
| 情報発信向け | 自己表現向け |

## 実装優先度

1. **Phase 1**: 長文対応（foldタグ、Kind 30023表示）
2. **Phase 2**: お絵かき機能（Canvas実装が比較的シンプル）
3. **Phase 3**: ボイスメモ機能（MediaRecorder、音声プレーヤー）

## 技術メモ

### MediaRecorder API
```javascript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
const recorder = new MediaRecorder(stream)
recorder.start()
// ... 録音中 ...
recorder.stop()
recorder.ondataavailable = (e) => {
  const blob = e.data // 音声データ
}
```

### Canvas お絵かき
```javascript
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
ctx.strokeStyle = '#000'
ctx.lineWidth = 3
ctx.lineCap = 'round'
// マウス/タッチイベントで描画
```

### nostr.build アップロード
- 既存の画像アップロード機能を流用
- Content-Type を適切に設定（audio/webm, image/png等）
- NIP-98認証も同様に使用
