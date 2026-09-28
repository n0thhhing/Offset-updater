#!/bin/sh
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
clang++ -O3 -shared -std=c++20 -fblocks -march=native "$DIR/scanner.cpp" "$DIR/capstone_wrapper.cpp" "$DIR/batch_scan.cpp" "$DIR/analysis.cpp" -I/opt/homebrew/include -L/opt/homebrew/lib -lcapstone -o "$DIR/libcore.dylib"
echo "Successfully compiled native/libcore.dylib"
