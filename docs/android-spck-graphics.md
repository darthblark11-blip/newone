# Android graphics in SPCK

SPCK's built-in preview uses an embedded browser. Chrome's `chrome://flags`
settings do not configure that embedded browser: Chrome and Android WebView
have separate settings. [Chrome's WebView documentation](https://developer.chrome.com/docs/webview)
explains the separation.

Vulkan is a graphics API, rather than the graphics chip itself. ANGLE can
translate OpenGL ES/WebGL work to Vulkan or another backend. Selecting ANGLE
in Android's developer options does not prove that a particular WebView page
is using its Vulkan backend. [Android's Vulkan/ANGLE guide](https://developer.android.com/games/develop/vulkan/overview)
describes the native app-level configuration.

## What the game can request and report

The character renderer now requests `powerPreference: "high-performance"`,
matching the lighting renderer. This asks the browser to prioritize rendering
performance. It does not select Vulkan, override a driver blocklist, or change
SPCK's native app settings. The [WebGL specification](https://registry.khronos.org/webgl/specs/latest/1.0/#5.2.1)
defines this option as a hint that the implementation may ignore.

The repository now includes an `index.html` launcher that loads the game and
its runtime dependencies. Add `?graphics=1` to its URL to show the optional
graphics report, for example `http://localhost:7700/index.html?graphics=1`.
Use **Close**, start the game, then tap **Graphics** to reopen the report without
reloading. This lets the actual character and lighting contexts initialize.
Use **Copy report** to compare SPCK with Chrome.

The repository previously contained no HTML launcher. If SPCK already has a
custom `index.html`, you can keep it: the graphics request is in the updated
`game.js`. Load `graphics-report.js` after it to add the optional report. The
supplied launcher uses p5 1.9.4 from a CDN; for offline use, point that script
tag at your existing local p5 file. Existing story images and audio retain
their original relative filenames.

Interpret the report carefully:

- `ANGLE` alone does not identify which backend it selected.
- A renderer mentioning Vulkan and the device's GPU is evidence of that path.
- `SwiftShader`, `llvmpipe`, `softpipe` or `lavapipe` indicate software rendering,
  even when the renderer also mentions Vulkan.
- Hidden or generic renderer details mean the backend is unknown.
- The main p5 canvas uses 2D drawing. A WebGL context's renderer does not prove
  how the browser accelerates the final 2D canvas and page compositing.

Renderer readiness and activation are separate. The frame-budget watchdog can
disable lighting while its GPU context still exists; the report includes that
reason instead of treating it as a missing GPU.

The report and requested power preference do not change the game's simulation
or install graphics drivers. Native hardware-acceleration controls belong to
the hosting Android app. [Android hardware-acceleration documentation](https://developer.android.com/develop/ui/views/graphics/hardware-accel)
describes those app/activity settings.

## Trying Vulkan inside SPCK's preview

WebView has its own on-device **WebView DevTools**. Current Chromium includes
the experimental **DefaultANGLEVulkan** flag, described as using ANGLE's Vulkan
backend. It may be absent from an older installed WebView provider.
See the [official supported flag list](https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/java/src/org/chromium/android_webview/common/ProductionSupportedFlagList.java).

With an ADB connection to the phone, launch that UI using:

```sh
adb shell am start -a "com.android.webview.SHOW_DEV_UI"
```

This command runs through Android Debug Bridge; it is not JavaScript and does
not run in SPCK's JavaScript console. In WebView DevTools, open **Flags**, enable
**DefaultANGLEVulkan** if present, then force-stop and reopen SPCK. Use **Reset
all to default** there and restart SPCK to undo the experiment. These settings
apply to WebView apps, rather than just this project. The [WebView DevTools guide](https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/developer-ui.md)
also documents launcher access through supported WebView channels. HTML cannot
add a missing WebView flag or guarantee that the device accepts this backend.

## Keeping the project local while using Chrome

Keep SPCK's local preview server running, then open its existing local URL
directly in the real Chrome app: `http://localhost:7700/index.html` in the user's
current setup. Save edits in SPCK and refresh Chrome. This uses local project
files and Chrome's known-working graphics settings; it does not require GitHub
Pages or publishing the game. The optional graphics view provides the local
URL and a Chrome launch action, but a host may block that action; manually
opening the URL in Chrome remains the fallback. Keep SPCK running while Chrome
loads files from its server.

## Verification

```sh
node tools/check-graphics-context.js
node tools/check-graphics-context-browser.cjs
node tools/check-graphics-launcher-browser.cjs
python3 tools/build-player3d.py --check
```

Browser checks use real Chromium/p5 with a software driver to verify truthful
classification, high-performance context requests, caching, context loss and
restoration, and the local launcher's optional controls. They do not verify
SPCK, Vulkan support or performance on the user's physical phone.
