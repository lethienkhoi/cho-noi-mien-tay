// Lớp bọc C mỏng quanh C API của sherpa-onnx cho game Chợ nổi miền Tây.
// Điền struct cấu hình ngay trong C để phía JS không phải tự sắp bộ nhớ struct.
// Chỉ dùng nhận giọng offline transducer (Zipformer), một luồng, có hotwords theo từng stream.
#include <emscripten.h>
#include <stdlib.h>
#include <string.h>

#include "sherpa-onnx/c-api/c-api.h"

extern "C" {

EMSCRIPTEN_KEEPALIVE
const SherpaOnnxOfflineRecognizer *cn_create(const char *encoder, const char *decoder,
                                             const char *joiner, const char *tokens,
                                             const char *bpe_vocab, const char *method,
                                             int max_active_paths, float hotwords_score,
                                             int num_threads, int debug) {
  SherpaOnnxOfflineRecognizerConfig c;
  memset(&c, 0, sizeof(c));
  c.feat_config.sample_rate = 16000;
  c.feat_config.feature_dim = 80;
  c.model_config.transducer.encoder = encoder;
  c.model_config.transducer.decoder = decoder;
  c.model_config.transducer.joiner = joiner;
  c.model_config.tokens = tokens;
  c.model_config.num_threads = num_threads > 0 ? num_threads : 1;
  c.model_config.provider = "cpu";
  c.model_config.debug = debug;
  c.model_config.model_type = "transducer";
  if (bpe_vocab && bpe_vocab[0]) {
    c.model_config.modeling_unit = "bpe";
    c.model_config.bpe_vocab = bpe_vocab;
  }
  c.decoding_method = (method && method[0]) ? method : "greedy_search";
  c.max_active_paths = max_active_paths > 0 ? max_active_paths : 4;
  c.hotwords_score = hotwords_score;
  return SherpaOnnxCreateOfflineRecognizer(&c);
}

EMSCRIPTEN_KEEPALIVE
void cn_destroy(const SherpaOnnxOfflineRecognizer *r) {
  if (r) SherpaOnnxDestroyOfflineRecognizer(r);
}

// Giải mã một đoạn âm thanh (float, -1..1). hotwords: các cụm cách nhau bởi "/", có thể "CỤM :2.0".
// Trả về chuỗi UTF-8 cấp phát bằng malloc (JS gọi _free sau khi đọc).
EMSCRIPTEN_KEEPALIVE
char *cn_decode(const SherpaOnnxOfflineRecognizer *r, const float *samples, int n,
                int sample_rate, const char *hotwords) {
  if (!r) return nullptr;
  const SherpaOnnxOfflineStream *s =
      (hotwords && hotwords[0]) ? SherpaOnnxCreateOfflineStreamWithHotwords(r, hotwords)
                                : SherpaOnnxCreateOfflineStream(r);
  if (!s) return nullptr;
  SherpaOnnxAcceptWaveformOffline(s, sample_rate, samples, n);
  SherpaOnnxDecodeOfflineStream(r, s);
  const SherpaOnnxOfflineRecognizerResult *res = SherpaOnnxGetOfflineStreamResult(s);
  char *out = strdup(res && res->text ? res->text : "");
  if (res) SherpaOnnxDestroyOfflineRecognizerResult(res);
  SherpaOnnxDestroyOfflineStream(s);
  return out;
}

}  // extern "C"
