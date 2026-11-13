# Android graphics in SPCK

## Vulkan selected, but character models invisible

The user confirmed that SPCK's preview reports **ANGLE using Vulkan with the
Adreno driver**, while player models remain invisible. Driver selection has
succeeded; visible output still depends on the character draw and its import
into the main p5 Canvas2D surface. This phone-specific failure has not been
reproduced in the development environment.

The investigation found a concrete failure-handling gap: `drawImage()` can
return without an exception even when the GPU produced no fragments or the
canvas import copied no visible pixels. The old renderer reported success in
both cases and suppressed the native character fallback. Both conditions were
reproduced with fault injection in real Chromium/WebGL2, including the
zero-WebGL-error case.

The character shaders contain a matrix projection, normal-based lighting and
three shading bands, with no texture lookups or loops. A standard pistol actor
uses 47 GPU draw calls; NM0 grey and armored actors previously measured 58 and
52. The meshes and 111 buffers are persistent across animation. Repeated
per-actor draw submission and immediate WebGL-to-Canvas copies are plausible
sources of overhead; those counts do not establish the cause of invisibility
or measure Vulkan translation time. No matching Adreno/SPCK driver defect was
confirmed.

The character context now requests **single-sample rendering**
(`antialias: false`), matching the world-lighting context. This removes the
default-framebuffer MSAA resolve from each character copy while retaining the
model geometry, shading, depth, stencil, blood and animation. No renderer-name
heuristic disables Vulkan or downgrades the models.

The shared character canvas keeps a bucketed allocation, but clears its whole
backing buffer before every actor. Clearing only the current actor rectangle
left older pixels just beyond the source crop; Canvas2D image filtering could
sample them and create a thin line beside or beneath a character. Full-buffer
clearing removes that edge bleed across zoom levels and smoothing modes
without extra GPU contexts, copies, readbacks or mesh uploads.

After initialization, backing-buffer growth or context restoration, the first
visible character draw checks WebGL errors, framebuffer completeness, GPU
alpha pixels and the same WebGL canvas imported into a scratch Canvas2D
surface. These checks use the existing character WebGL context. They perform
one synchronous GPU readback per check, can pause that first draw, and are
absent from subsequent ordinary actor draws. The scratch import validates the
cross-API copy, not Android's final on-screen compositor or every destination
canvas. Intentionally alpha-zero and empty selections do not count as a
broken renderer.

A failed check returns control to the existing native character painter and
stops repeated failed GPU submissions for that context generation. The
optional `?graphics=1` report now includes:

- `characters.pipeline.validation`: `pending`, `verified` or `failed`.
- `characters.pipeline.stage`: `shader`, `initialization`, `draw`,
  `canvas-transfer` or `ready`, with a failure message and WebGL error if any.
- GPU and copied alpha-pixel counts, validation count and validation time.
- Actual draw calls for the last actor, upload/buffer counts, and CPU elapsed
  times for submission and copying. These are **not GPU execution timings**.

Start the game, reopen **Graphics**, then use **Recheck character pixels** to
queue another check if models disappear later without a resize or context
loss. Close the report to resume a paused game, then reopen it and use
**Copy report**. A successful check identifies where pixels reached; it does
not prove that every final compositor path on the phone is correct.

## Android host and driver settings

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
node tools/check-player3d-transfer-browser.cjs
node tools/check-player3d-crop-browser.cjs
node tools/check-player3d-browser.cjs
python3 tools/build-player3d.py --check
```

Browser checks use real Chromium/p5 with a software driver to verify truthful
classification, high-performance context requests, caching, context loss and
restoration, the local launcher's optional controls, actual character pixels,
injected blank draw/transfer failures, native fallback, explicit rechecks and
the absence of repeated readbacks during stable animation. They do not verify
SPCK or Adreno behavior or performance on the user's physical phone.
