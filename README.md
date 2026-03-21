# fast-stage-code-

## SharePoint での使い方

### 重要
このツールは `index.html` を直接 SharePoint のドキュメント ライブラリでクリックしても、**SharePoint 側の HTML / スクリプト制限により開かないことがあります**。
そのため、**「SharePoint に HTML を置いて直接実行する」方式ではなく、静的ホストに置いた `index.html` を SharePoint からリンクして開く**のが最も簡単で確実です。

### 最も簡単な運用方法
1. `index.html` を静的ホスティング先へ配置する。
   例: Azure Static Web Apps / Azure App Service / GitHub Pages / 社内Webサーバー
2. SharePoint 側ではファイルを直接クリックさせず、**リンク**としてそのURLを案内する。
3. 利用者は SharePoint 上のリンクからブラウザーで開き、手元のCSVを選択して使う。

### このリポジトリの現状
- ツール本体は `index.html` の **単体ファイル構成** です。
- デモ表示や使い方説明も `index.html` に内包されています。
- SharePoint 上に補助CSVや別マニュアルHTMLを置かなくても動作確認できます。

### SharePoint へ直接置く方式が向かない理由
- HTML ファイルをそのまま Web アプリとして実行させる用途に SharePoint 文書ライブラリは向いていません。
- 組織設定や SharePoint のセキュリティ方針により、空白タブ・ダウンロード・プレビュー不可などの挙動になります。

### ネイティブに SharePoint 上で動かしたい場合
その場合は HTML ファイル配布ではなく、次の方式が必要です。

- SharePoint Framework (SPFx) Web パーツ化
- Power Apps 化
- 管理者許可のある別の社内ホスティング方式
