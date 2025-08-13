#!/bin/bash
set -euo pipefail
CMDNAME=$(basename "$0")

# ─── ヘルプ表示 ───────────────────────────────────────────────
show_help() {
  cat << EOF
下記の引数を指定してください
-i : インポートする動画ファイル
-s : 縦横のサイズ。縦:横のピクセルで指定。-1を指定すると、他のサイズを元に縦横比を維持する
      例 : 600:-1
-f : fps。整数を入れてください
-e : エクスポート先のファイルパス

使い方例:
  $CMDNAME -i movie.mp4 -s 480:-1 -f 15 -e out.gif
EOF
}

# ─── オプションなしならヘルプ ─────────────────────────────────
[[ $# -eq 0 ]] && { show_help; exit 0; }

# ─── 引数解析 ────────────────────────────────────────────────
while getopts ":i:s:f:e:h" OPT; do
  case $OPT in
    i) import="$OPTARG" ;;
    s) size="$OPTARG"  ;;
    f) fps="$OPTARG"   ;;
    e) export="$OPTARG";;
    h) show_help; exit 0 ;;
    \?) echo "不明なオプション: -$OPTARG" >&2; show_help; exit 1 ;;
    :)  echo "オプション -$OPTARG には値が必要です" >&2; show_help; exit 1 ;;
  esac
done
shift $((OPTIND - 1))

# ロングオプション --help
if [[ ${1:-} == "--help" ]]; then
  show_help; exit 0
fi

# ─── 必須チェック ───────────────────────────────────────────
[[ -z ${import:-}  ]] && { echo "インポートする動画ファイルが選択されてません"; exit 1; }
[[ -z ${export:-}  ]] && { echo "ファイルの書き出し先が指定されていません"; exit 1; }

# デフォルト値
size=${size:--1:-1}
fps=${fps:-12}

# ─── 一時パレット生成 & 後始末 ───────────────────────────────
palette=$(mktemp /tmp/ffpalette_XXXXXX.png)
trap 'rm -f "$palette"' EXIT INT TERM

# ─── 変換処理 ────────────────────────────────────────────────
ffmpeg -i "$import" -vf palettegen -y "$palette"
ffmpeg -i "$import" -i "$palette" \
       -lavfi "fps=${fps},scale=${size}:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
       -y "$export"

exit 0
