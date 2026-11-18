#!/bin/zsh
set -eu
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
preview_url='http://127.0.0.1:3016/materials/'
is_ready() {
  local page
  page=$(/usr/bin/curl -fsS --max-time 2 "$preview_url" 2>/dev/null) || return 1
  [[ "$page" == *'<title>文档与图片'* ]]
}
if is_ready; then
  /usr/bin/open "$preview_url"
  exit 0
fi
if [[ ! -x node_modules/.bin/vite ]]; then
  print '尚未安装项目依赖，请在此目录运行 npm ci。'
  read '?按回车结束。'
  exit 1
fi
node_modules/.bin/vite --host 127.0.0.1 --port 3016 --strictPort &
preview_pid=$!
trap 'kill "$preview_pid" 2>/dev/null || true' EXIT
trap 'exit 0' INT TERM
for attempt in {1..50}; do
  if is_ready; then
    /usr/bin/open "$preview_url"
    print '工作台已打开。保持此窗口开启，按Control+C停止本次服务。'
    wait "$preview_pid"
    exit 0
  fi
  if ! kill -0 "$preview_pid" 2>/dev/null; then
    wait "$preview_pid"
    exit 1
  fi
  sleep 0.2
done
print '服务尚未就绪，请查看上方日志。端口被占用时不会停止其他服务。'
wait "$preview_pid"
