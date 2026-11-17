#!/usr/bin/env bash
# Dựng lõi nhận giọng WebAssembly (sherpa-onnx, chỉ phần ASR offline) cho game.
# Cách dùng: SHERPA=/đường/dẫn/sherpa-onnx [DEPS=/thư/mục/deps] ./build.sh   (cần emsdk 4.0.23 đã "source emsdk_env.sh")
# Kết quả chép vào assets/asr/chonoi-asr.{js,wasm}.
set -ex
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
SHERPA=${SHERPA:?đặt SHERPA trỏ tới bản clone k2-fsa/sherpa-onnx}
rm -rf "$SHERPA/wasm/chonoi" && mkdir -p "$SHERPA/wasm/chonoi"
cp "$HERE/CMakeLists.txt" "$HERE/chonoi-asr.cc" "$SHERPA/wasm/chonoi/"
grep -q 'wasm/chonoi\|add_subdirectory(chonoi)' "$SHERPA/wasm/CMakeLists.txt" || \
  printf '\nif(SHERPA_ONNX_ENABLE_WASM_CHONOI)\n  add_subdirectory(chonoi)\nendif()\n' >> "$SHERPA/wasm/CMakeLists.txt"
mkdir -p "$SHERPA/build-wasm-chonoi" && cd "$SHERPA/build-wasm-chonoi"
export SHERPA_ONNX_IS_USING_BUILD_WASM_SH=ON
# Mạng chặn tải tarball archive của GitHub: nếu đặt DEPS (thư mục chứa các bản git clone đúng tag) thì dùng nguồn cục bộ.
EXTRA=()
if [ -n "$DEPS" ]; then
  for n in kaldi_native_fbank kaldi_native_io kissfft openfst utf8proc kaldifst kaldi_decoder kaldi_hmm_gmm simple-sentencepiece json eigen; do
    [ -d "$DEPS/$n" ] && EXTRA+=("-DFETCHCONTENT_SOURCE_DIR_$(echo $n | tr a-z A-Z)=$DEPS/$n")
  done
fi
cmake -DCMAKE_INSTALL_PREFIX=./install -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_TOOLCHAIN_FILE=$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake \
  -DSHERPA_ONNX_ENABLE_PYTHON=OFF -DSHERPA_ONNX_ENABLE_TESTS=OFF -DSHERPA_ONNX_ENABLE_CHECK=OFF \
  -DBUILD_SHARED_LIBS=OFF -DSHERPA_ONNX_ENABLE_PORTAUDIO=OFF -DSHERPA_ONNX_ENABLE_JNI=OFF \
  -DSHERPA_ONNX_ENABLE_C_API=ON -DSHERPA_ONNX_ENABLE_TTS=OFF -DSHERPA_ONNX_ENABLE_SPEAKER_DIARIZATION=OFF \
  -DSHERPA_ONNX_ENABLE_WEBSOCKET=OFF -DSHERPA_ONNX_ENABLE_GPU=OFF -DSHERPA_ONNX_ENABLE_WASM=ON \
  -DSHERPA_ONNX_ENABLE_WASM_CHONOI=ON -DSHERPA_ONNX_ENABLE_BINARY=OFF \
  -DSHERPA_ONNX_LINK_LIBSTDCPP_STATICALLY=OFF "${EXTRA[@]}" ..
make -j"$(nproc)" chonoi-asr
mkdir -p "$ROOT/assets/asr"
cp bin/chonoi-asr.js bin/chonoi-asr.wasm "$ROOT/assets/asr/"
ls -l "$ROOT/assets/asr"
