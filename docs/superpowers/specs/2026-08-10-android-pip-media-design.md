# Android PiP and Media Integration Design

## Existing playback remains authoritative

Playback stays Vidstack in the WebView using the working `127.0.0.1` Kotlin SAF range server. PiP or media buttons do not justify replacing the player with Media3. The bridge carries provider-neutral playback actions and state only.

## Picture-in-Picture

`MainActivity` declares PiP support without adding an exported service. A narrow plugin command requests manual PiP only when a real video is ready. React supplies an aspect ratio and generic action availability; no lesson/course metadata is sent to system surfaces. Activity PiP callbacks are emitted to the WebView so Limmud hides non-video chrome and maintains one player instance. Expanding returns to the same Study lesson.

Automatic PiP is disabled initially. It may be enabled only after physical acceptance proves Android Home behavior coherent and only while actively playing with no picker/dialog active.

## System media and audio policy

The WebView player remains the playback authority. A native media-session bridge mirrors playing/paused/position/action availability and sends play, pause, previous, and next actions back to React. Lock-screen metadata is generic (`Limmud`, `Study session`) to avoid exposing private course or lesson names.

Normal backgrounding pauses playback unless the activity is entering PiP. Audio-focus loss pauses; transient loss may remember that playback was active but never resumes after permanent loss. Becoming-noisy pauses immediately. Receivers/listeners exist only while playback is active and are released with the activity/plugin lifecycle. No foreground playback service or invisible background video is added.

## Range-server hardening

Tokens remain random, single-resource, and revocable, and gain bounded idle/absolute expiry plus periodic cleanup. Unknown, expired, or released tokens return a generic failure. The server stays loopback-only, validates single byte ranges, uses bounded buffers, contains client disconnects, and never logs or reflects native identifiers. CORS is restricted to the minimum WebView behavior proven necessary.

## Acceptance

Real Samsung acceptance covers manual PiP, expand/close, one audio stream, correct return lesson, player controls, orientation, subtitles, background pause, audio focus, and becoming-noisy where hardware permits. Unsupported device settings are reported as specifically blocked, never simulated as success.
