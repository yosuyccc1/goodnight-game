# 遊戲明體字型來源與子集

查證及製作日期：2026-09-26。這份字型以 **Google Fonts 官方 Noto Serif TC 2.003** 製作，繁體中文字形採臺灣版本；保留網站用字並將可變字型固定為 **Regular 400**，產生 WOFF2。前一版粉圓體檔案、字元清單、授權及來源紀錄均保留。

## 官方來源與授權

- [Google Fonts 官方 Noto Serif TC 目錄](https://github.com/google/fonts/tree/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoseriftc)
- [固定版本原始 TTF](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoseriftc/NotoSerifTC%5Bwght%5D.ttf)
- [官方 METADATA.pb](https://github.com/google/fonts/blob/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoseriftc/METADATA.pb)，標明 SERIF、繁體中文及 `wght` 200–900；其上游為 notofonts/noto-cjk。
- [固定版本官方 OFL.txt](https://github.com/google/fonts/blob/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoseriftc/OFL.txt)
- 完整、未修改的授權原文：[serif-OFL-LICENSE.txt](serif-OFL-LICENSE.txt)。

授權為 **SIL Open Font License 1.1**，可依其條件修改、嵌入及隨網站散布；字型本身不可單獨販售，散布時須保留著作權與授權。此次官方 OFL 檔及字型著作權欄位沒有另外指定 Reserved Font Name；為區分網站子集與官方完整版本，仍將子集改名 **Taiwan Game Serif**，維持 OFL 1.1。官方 OFL 檔的 Google 著作權聲明及字型內部 Adobe 著作權、授權欄位均保留；不表示上游作者替本遊戲背書。

Google Fonts 固定 commit：`8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`。官方 metadata 記錄的 notofonts 上游 commit：`985fa52c81c1d6692ccdd82bc3656e8fb932fd89`。

## 輸出與驗證

- 檔案：[taiwan-game-serif.woff2](taiwan-game-serif.woff2)，**106,164 bytes（約 103.7 KiB）**。
- 內部 family：`Taiwan Game Serif`；PostScript name：`TaiwanGameSerif-Regular`；字重 400；樣式 normal；網站 CSS alias 可設為 `Game Serif`。
- 來源檔名：`NotoSerifTC[wght].ttf`，16,851,596 bytes，內部版本 `2.003-H1`。來源預設軸值為 200；本次透過 fontTools 的 variation instancer 計算真正的 400 字重輪廓，沒有使用預設 ExtraLight 輪廓充當 Regular。
- 收錄 **421 個 Unicode 碼位**：310 個漢字、全部 95 個可列印 ASCII（U+0020–U+007E），以及原遊戲其餘標點、箭頭及符號。必要 OpenType 排版依存字形一併保留，共 797 個 glyph。
- 字元範圍為前一版 [subset-characters.txt](subset-characters.txt) 的全部字元，加上目前 `dist/index.html` 與六個 `.mjs` 檔案的去重文字；同時解析 HTML entity、JavaScript Unicode／hex escape。並保留原先全部 409 碼位，再加入下方過關文案所需的 9 個字元。精確清單：[serif-subset-characters.txt](serif-subset-characters.txt)。
- 七個急流名稱「兒虐問題」「雙城辯論」「法律博士」「利益迴避」「英文口說」「食安事件」「王偉忠訪談」、日期數字與分隔符號均涵蓋。最新文案「急流外側光暈不計入碰撞」及原要求的「陰影」亦完整涵蓋。
- 重新載入 WOFF2 核對全部要求碼位，缺字 **0**；`OS/2.usWeightClass=400`、`OS/2.fsType=0`，輸出不含 `fvar`／`gvar`，為固定字重。另確認「流」的輪廓座標確實由來源預設 200 改為 400。

SHA-256：

```text
source TTF: 0077e18f57c6908f4a000969880940bdb0dad057c0e8d98b49dc364c3d1b09c6
WOFF2:      2631a6889b12d11199852b5d56d1911bcf784e0629ddc53da5d498c90d3813af
OFL:        5e0da210fb04058a8c0087985d2d456b931c2579811a49655721d3cf0c36b6d6
```

## 過關文案補字（2026-09-26）

- 新增文案：「恭喜萬安成功撐到 11月28日」與「11月28日記得去投票！」。
- 原子集缺 9 個字元：去 `U+53BB`、喜 `U+559C`、得 `U+5F97`、恭 `U+606D`、投 `U+6295`、月 `U+6708`、票 `U+7968`、記 `U+8A18`、！ `U+FF01`。本次從相同 SHA-256 的固定來源 TTF 重新取子集並實例化為 400，內部 unique ID 版本更新為 `Subset2`。
- 保留原本全部 409 碼位；新輸出涵蓋 418 碼位。重新載入輸出檔，比對原有碼位及兩段新增文案，缺字 **0**。授權檔未修改，字型內部著作權與授權欄位（name ID 0、13、14）與前一版逐筆相同。
- 前一版 WOFF2 SHA-256：`33cf6520ac67365337a569966319a367b4cb17682fc5228a15e5a8a29a821f90`；本版檔案大小、glyph 數及 SHA-256 見上方輸出與驗證。

## 鮮奶護體補字（2026-09-27）

- 為角色上方的「鮮奶護體」補入「鮮」「奶」「體」三個字，與「萬安」使用同一明體字型。
- 使用相同 SHA-256 的固定來源 TTF，保留原有 418 碼位與授權資訊，仍為 Regular 400；新子集涵蓋 421 碼位，缺字 0。

## 重製方式

工具版本：Python 3.12、fontTools 4.66.0、Brotli 1.2.0。依下列程序使用固定版本官方 TTF 及本目錄字元清單；先取子集縮小運算範圍，再將所有保留字形實例化為字重 400。工具只安裝於暫存目錄，沒有新增網站執行時相依套件。

```python
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

font = TTFont("NotoSerifTC[wght].ttf", recalcTimestamp=False)
chars = Path("serif-subset-characters.txt").read_text(encoding="utf-8")
options = subset.Options()
options.flavor = "woff2"
options.name_IDs = ["*"]
options.name_languages = ["*"]
options.layout_features = ["*"]
options.recalc_timestamp = False
builder = subset.Subsetter(options=options)
builder.populate(unicodes=sorted(map(ord, set(chars))))
builder.subset(font)
font = instantiateVariableFont(font, {"wght": 400}, inplace=True)
family = "Taiwan Game Serif"
names = {
    1: family, 2: "Regular",
    3: "TaiwanGameSerif-Regular-Noto2.003-Subset3",
    4: family + " Regular", 6: "TaiwanGameSerif-Regular",
    16: family, 17: "Regular", 18: family + " Regular",
    21: family, 22: "Regular",
}
for record in list(font["name"].names):
    if record.nameID in names:
        font["name"].setName(names[record.nameID], record.nameID,
                             record.platformID, record.platEncID, record.langID)
for name_id, value in names.items():
    font["name"].setName(value, name_id, 3, 1, 0x409)
font.flavor = "woff2"
font.save("taiwan-game-serif.woff2")
```

新增文案後須重新核對字元清單，必要時重製。原始完整 TTF 留於製作暫存區，不納入網站資產。
