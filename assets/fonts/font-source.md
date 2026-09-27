# 遊戲圓體字型來源與子集

查證及製作日期：2026-09-26。此目錄的字型為網站專用子集，原始字型是 justfont 的 **jf open 粉圓 2.1**。

## 官方來源與授權

- [justfont 官方專案](https://github.com/justfont/open-huninn-font)
- [官方 v2.1 release](https://github.com/justfont/open-huninn-font/releases/tag/v2.1)
- [官方 TTF 下載](https://github.com/justfont/open-huninn-font/releases/download/v2.1/jf-openhuninn-2.1.ttf)
- [v2.1 官方授權原文](https://github.com/justfont/open-huninn-font/blob/v2.1/LICENSE)
- 完整、未修改的授權檔：[OFL-LICENSE.txt](OFL-LICENSE.txt)

字型採 SIL Open Font License 1.1，可依其條件修改、嵌入及隨軟體或網站散布。字型本身不可單獨販售；散布時須保留著作權聲明及授權。原授權保留 `open huninn`、`huninn` 等名稱，因此這份修改後的子集改名為 **Taiwan Game Rounded**，仍依 OFL 1.1 散布。justfont 為上游字型作者，未替本遊戲或此子集背書。

## 輸出與範圍

- 檔案：[taiwan-game-rounded.woff2](taiwan-game-rounded.woff2)，**76,068 bytes（約 74.3 KiB）**。
- 字型內部 family：`Taiwan Game Rounded`；PostScript name：`TaiwanGameRounded-Regular`；字重：400；樣式：normal。網站可用自己的 CSS family alias，例如 `Game Rounded`。
- 收錄 **407 個 Unicode 碼位**，包含 **297 個漢字**、全部 **95 個可列印 ASCII**（U+0020–U+007E），以及遊戲使用的其他標點、箭頭及符號。OpenType 排版依存字形一併保留，共 598 個 glyph。
- 字元由目前 `dist/` 的 `index.html` 與六個 `.mjs` 檔案完整文字去重取得，另解碼 HTML entity、JavaScript Unicode／hex escape，加入所有可列印 ASCII，以及「急流外側陰影不計入碰撞」。不替非顯示控制字元建立字形。
- 已核對七個急流名稱：「兒虐問題」「雙城辯論」「法律博士」「利益迴避」「英文口說」「食安事件」「王偉忠訪談」，以及日期所需數字／分隔符號。
- 精確字元清單：[subset-characters.txt](subset-characters.txt)。重新載入輸出 WOFF2，核對全部 407 個要求碼位均有實際字形，**缺字 0**；字型 `OS/2.fsType` 為 0。
- 未改字形輪廓；修改限字元子集、保留必要排版字形、WOFF2 壓縮與內部名稱。原字型的著作權及授權 name records 保留。

原 TTF 大小：4,911,464 bytes。SHA-256：

```text
source TTF: 9d5bf4932d31fe94c18cd8cfddc98bc1b14ce10f4e354c682179db290a99c825
WOFF2:      816ce258af813a734c81c1272ee8e9d94c836b66c97df28edb220d2b985b573b
LICENSE:    5df6de36ba2fe26119ac161edbed97c62a9da3c1493f6930b9d9af7f5c93004b
```

## 製作方式

工具版本：Python 3.12、fontTools 4.66.0、Brotli 1.2.0。製作工具只安裝於暫存目錄，沒有新增網站執行時相依套件。以官方原始 TTF 及本目錄的字元清單執行以下程序；程式須在包含兩個輸入檔的工作目錄執行。

```python
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

font = TTFont("jf-openhuninn-2.1.ttf", recalcTimestamp=False)
chars = Path("subset-characters.txt").read_text(encoding="utf-8")
options = subset.Options()
options.flavor = "woff2"
options.name_IDs = ["*"]
options.name_languages = ["*"]
options.layout_features = ["*"]
options.recalc_timestamp = False
builder = subset.Subsetter(options=options)
builder.populate(unicodes=sorted(map(ord, set(chars))))
builder.subset(font)
family = "Taiwan Game Rounded"
names = {
    1: family, 2: "Regular",
    3: "TaiwanGameRounded-Regular-2.1-Subset1",
    4: family + " Regular", 6: "TaiwanGameRounded-Regular",
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
font.save("taiwan-game-rounded.woff2")
```

新增遊戲文案後，須重新核對字元清單並重製子集；這份檔案只承諾上述字元範圍，並非完整繁體中文字型。原始完整 TTF 留在製作暫存區，沒有納入網站資產。
