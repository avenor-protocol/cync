#!/bin/sh
# Run on your own machine (Git Bash works): sh deploy/push.sh root@SERVER_IP
# Uploads the last commit and .env.production to the server, then runs deploy.sh there.
set -eu
target=${1:?usage: sh deploy/push.sh root@SERVER_IP}
cd "$(dirname "$0")/.."
dir=/opt/cync

[ -f .env.production ] || { echo "error: missing .env.production" >&2; exit 1; }
git diff --quiet HEAD -- || echo "note: uncommitted changes are not uploaded, only the last commit"

# only committed files go up, so nothing local (keys, notes, build output) leaks to the server
git archive --format=tar HEAD |
  ssh "$target" "rm -rf $dir.new && mkdir -p $dir.new && tar -x -C $dir.new && rm -rf $dir && mv $dir.new $dir"
scp -q .env.production "$target:$dir/.env.production"
[ ! -f .env.mainnet ] || scp -q .env.mainnet "$target:$dir/.env.mainnet"
ssh "$target" "sh $dir/deploy/deploy.sh"
