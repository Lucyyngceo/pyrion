#!/usr/bin/env bash
# Runs the TARS trial and the judge battery once per model, on a temporary instance of the deployed build (port 3031), reached over an SSH tunnel.
set -u
HOST=root@2.24.113.113
MODELS="openai/gpt-oss-120b google/gemma-4-31b-it nvidia/nemotron-3-super-120b-a12b mistralai/mistral-small-3.2-24b-instruct meta-llama/llama-4-maverick z-ai/glm-5.3"
cd "$(dirname "$0")/../.."
ssh -f -N -L 3031:127.0.0.1:3031 $HOST
for M in $MODELS; do
  L=$(echo "$M" | tr '/' '_')
  ssh $HOST "cd /root/pyrion/web && pm2 delete pyrion-trial >/dev/null 2>&1; OPENROUTER_MODELS=$M PYRION_CLIENT_MODELS=$M PYRION_LLM_MODELS=none/none PYRION_TRUST_PROXY=0 PYRION_VISITOR_LIMIT_PER_HOUR=1000 PYRION_VISITOR_PRIMARY_PER_HOUR=1000 pm2 start npm --name pyrion-trial -- run start -- -H 127.0.0.1 -p 3031 >/dev/null && sleep 8 && curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3031/api/ask"
  echo " started $M"
  python -I validation/model_trial/tars_trial.py http://localhost:3031 "$L"
  python -I validation/judge_battery/run.py http://localhost:3031 > "validation/model_trial/results/${L}.battery.txt" 2>&1
  tail -3 "validation/model_trial/results/${L}.battery.txt"
done
ssh $HOST "pm2 delete pyrion-trial >/dev/null 2>&1; echo trial-instance-removed"
pkill -f "3031:127.0.0.1:3031" || true
