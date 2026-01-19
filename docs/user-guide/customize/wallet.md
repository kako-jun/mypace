# ウォレット設定

カラーステラを送るには、Lightningウォレットの接続が必要です。

## WebLNとは

WebLNは、ブラウザからLightning Networkに接続するための標準規格です。
対応ウォレットを使うことで、ウェブサイトから直接ビットコインの送金ができます。

## 対応ウォレット

以下のウォレットがWebLNに対応しています:

- [Alby](https://getalby.com/) - ブラウザ拡張機能（おすすめ）
- [Wallet of Satoshi](https://www.walletofsatoshi.com/) - モバイルアプリ
- その他WebLN対応ウォレット

## 接続方法

1. 対応ウォレットをインストール
2. ホーム右下の「INV」ボタン、または設定画面の「ACCOUNT」タブ → 「Inventory →」をクリック
3. インベントリページで「Connect Wallet」をクリック
4. ウォレットの接続許可ダイアログが表示されたら「許可」

## 接続状態の確認

### 設定画面

設定画面の「ACCOUNT」タブに「Wallet」セクションがあります:

- **未接続**: 「Not connected」と表示
- **接続済み**: ウォレット名が表示

「Inventory →」をクリックするとインベントリページに移動します。

### インベントリページ

残高がカラーステラとして表示されます（sats表示ではありません）:

- Purple ★ × 1 = 1,000 sats相当
- Blue ★ × 5 = 500 sats相当
- Red ★ × 3 = 30 sats相当
- Green ★ × 2 = 2 sats相当

## カラーステラを受け取るには

カラーステラを受け取るには、プロフィールにLightningアドレス（lud16）を設定する必要があります。

1. プロフィール編集画面を開く
2. 「Lightningアドレス」欄にアドレスを入力
   - 例: `username@getalby.com`
3. 保存

Lightningアドレスは多くのウォレットサービスで無料で取得できます。

---

[← カスタマイズに戻る](./index.md)
