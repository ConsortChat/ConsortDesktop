// Starting at login, in the Microsoft Store build.
//
// WHY a native addon: an app installed from an MSIX package cannot start itself
// at login the way the installer build does. Electron's setLoginItemSettings
// writes the Run key under HKEY_CURRENT_USER, and a packaged app's writes there
// land in a private copy of the hive that Windows keeps for the package and
// nothing at login reads — so the setting would be saved, show as on, and do
// nothing. A packaged app declares a startup task in its manifest instead (see
// packaging/appx-extensions.xml) and switches it through
// Windows.ApplicationModel.StartupTask, which is WinRT and out of Electron's
// reach.
//
// The task answers to Windows before it answers to the app. Somebody can switch
// it off in Settings or Task Manager, and after that the app can ask all it
// likes: RequestEnableAsync answers "disabledByUser" and changes nothing,
// because only the person who switched it off gets to switch it back on. So
// every call here resolves with the state Windows ended up in rather than
// whether the request was granted, and the caller believes that over its own
// setting.
//
// Only meaningful with package identity. Unpackaged — the installer build, a
// working tree — GetAsync fails and the promise rejects, which is why the
// caller asks process.windowsStore before it ever gets here.

#include <napi.h>

#include <windows.h>

#include <roapi.h>
#include <winrt/Windows.ApplicationModel.h>
#include <winrt/Windows.Foundation.h>

#include <cstdio>
#include <exception>
#include <string>
#include <utility>

namespace {

using winrt::Windows::ApplicationModel::StartupTask;
using winrt::Windows::ApplicationModel::StartupTaskState;

enum class Request { kQuery, kEnable, kDisable };

// The names app/main/startup.ts expects. Two files, one list.
const char* StateName(StartupTaskState state) {
  switch (state) {
    case StartupTaskState::Disabled:
      return "disabled";
    case StartupTaskState::DisabledByUser:
      return "disabledByUser";
    case StartupTaskState::Enabled:
      return "enabled";
    case StartupTaskState::DisabledByPolicy:
      return "disabledByPolicy";
    case StartupTaskState::EnabledByPolicy:
      return "enabledByPolicy";
    default:
      // A state added to Windows after this was written. Reported as off,
      // since none of the ones known today that start the app are missing.
      return "disabled";
  }
}

/**
 One request, run off the JavaScript thread.

 Off it because every StartupTask call is asynchronous, and C++/WinRT refuses to
 block on one from a single-threaded apartment — which the main thread of an
 Electron process may be. A thread-pool thread joins the multithreaded apartment
 for the length of the request, waits there, and leaves again.
 */
class StartupTaskWorker : public Napi::AsyncWorker {
 public:
  StartupTaskWorker(Napi::Env env, std::wstring taskId, Request request)
      : Napi::AsyncWorker(env),
        deferred_(Napi::Promise::Deferred::New(env)),
        taskId_(std::move(taskId)),
        request_(request) {}

  Napi::Promise Promise() const { return deferred_.Promise(); }

 protected:
  void Execute() override {
    const HRESULT apartment = RoInitialize(RO_INIT_MULTITHREADED);
    if (FAILED(apartment)) {
      SetError("could not join the multithreaded apartment");
      return;
    }

    // Scoped so that the task is released before the apartment it lives in.
    try {
      const StartupTask task = StartupTask::GetAsync(taskId_).get();
      switch (request_) {
        case Request::kEnable:
          state_ = task.RequestEnableAsync().get();
          break;
        case Request::kDisable:
          task.Disable();
          state_ = task.State();
          break;
        case Request::kQuery:
          state_ = task.State();
          break;
      }
    } catch (const winrt::hresult_error& error) {
      char code[16];
      std::snprintf(code, sizeof code, "0x%08X",
                    static_cast<unsigned int>(error.code().value));
      SetError(winrt::to_string(error.message()) + " (" + code + ")");
    } catch (const std::exception& error) {
      SetError(error.what());
    }

    RoUninitialize();
  }

  void OnOK() override {
    deferred_.Resolve(Napi::String::New(Env(), StateName(state_)));
  }

  void OnError(const Napi::Error& error) override {
    deferred_.Reject(error.Value());
  }

 private:
  Napi::Promise::Deferred deferred_;
  std::wstring taskId_;
  Request request_;
  StartupTaskState state_ = StartupTaskState::Disabled;
};

Napi::Value Queue(const Napi::CallbackInfo& info, Request request,
                  const char* usage) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, usage).ThrowAsJavaScriptException();
    return env.Undefined();
  }

  const std::u16string taskId = info[0].As<Napi::String>().Utf16Value();
  // Deletes itself once it has settled the promise.
  auto* worker = new StartupTaskWorker(
      env, std::wstring(taskId.begin(), taskId.end()), request);
  const Napi::Promise promise = worker->Promise();
  worker->Queue();
  return promise;
}

Napi::Value Query(const Napi::CallbackInfo& info) {
  return Queue(info, Request::kQuery, "query(taskId: string)");
}

Napi::Value Enable(const Napi::CallbackInfo& info) {
  return Queue(info, Request::kEnable, "enable(taskId: string)");
}

Napi::Value Disable(const Napi::CallbackInfo& info) {
  return Queue(info, Request::kDisable, "disable(taskId: string)");
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("query", Napi::Function::New(env, Query));
  exports.Set("enable", Napi::Function::New(env, Enable));
  exports.Set("disable", Napi::Function::New(env, Disable));
  return exports;
}

}  // namespace

NODE_API_MODULE(consort_startup, Init)
