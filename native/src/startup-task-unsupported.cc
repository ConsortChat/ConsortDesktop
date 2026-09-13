// The startup task addon on platforms that have no startup tasks.
//
// It exists so that building the app on Linux or macOS is not a failure over a
// Windows-only capability. Nothing calls it there: app/main/startup.ts asks
// process.windowsStore first, which is only ever true on Windows. Every call
// rejects rather than answering "disabled", so that one which does get here is
// a mistake somebody sees rather than a setting that quietly reads as off.

#include <napi.h>

namespace {

Napi::Value Refuse(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  auto deferred = Napi::Promise::Deferred::New(env);
  deferred.Reject(
      Napi::Error::New(env, "there are no startup tasks on this platform")
          .Value());
  return deferred.Promise();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("query", Napi::Function::New(env, Refuse));
  exports.Set("enable", Napi::Function::New(env, Refuse));
  exports.Set("disable", Napi::Function::New(env, Refuse));
  return exports;
}

}  // namespace

NODE_API_MODULE(consort_startup, Init)
