#!/bin/bash
NODEJS_DIR="$1"
if [ -z "$NODEJS_DIR" ]; then
  echo "Error: NODEJS_DIR argument is missing"
  exit 1
fi

cd "$NODEJS_DIR"
echo "=== REMOTE STARTING NODE SERVER.JS IN BACKGROUND ==="
# Delete old debug_env.log and console.log to start fresh
rm -f debug_env.log console.log

# Run node server.js in background, redirecting stdout/stderr to console.log
/opt/alt/alt-nodejs22/root/bin/node server.js > console.log 2>&1 &
PID=$!

echo "Started Node process with PID: $PID"
sleep 4

echo "=== SENDING TEST HTTP REQUEST TO LOCALHOST:3000 ==="
curl -i http://127.0.0.1:3000/ || echo "Curl failed"

echo "=== DIAGNOSTIC CONSOLE LOG OUTPUT ==="
if [ -f console.log ]; then
  cat console.log
else
  echo "No console.log file found!"
fi

echo "=== DIAGNOSTIC DEBUG_ENV LOG OUTPUT ==="
if [ -f debug_env.log ]; then
  cat debug_env.log
else
  echo "No debug_env.log file found!"
fi

echo "Killing Node process $PID..."
kill -9 $PID || true
rm -f console.log debug_env.log
echo "Diagnostic script completed."
