#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "请先安装 Node.js 22 或更高版本，再启动游戏。"
  read -r "?按回车关闭…"
  exit 1
fi
node server.mjs &
game_pid=$!
trap 'kill "$game_pid" 2>/dev/null' EXIT INT TERM
sleep 1
if kill -0 "$game_pid" 2>/dev/null; then
  open "http://127.0.0.1:${PORT:-4173}"
  wait "$game_pid"
fi
