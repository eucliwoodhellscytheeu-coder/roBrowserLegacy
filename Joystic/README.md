## Controls and assignment

Drag the joystick to walk; release to stop. Direction, dead zone, and collision checks run locally. Ordinary versioned Ragnarok movement packets synchronize with the game server; no custom joystick server support is needed. ATK selects the nearest reachable living monster or eligible player opponent on a PvP/GvG map and sends the normal attack request. Native party/guild eligibility checks are retained; players on normal maps are excluded. Older PvP-zone map properties are supported as well.

Joystick movement follows the existing MobileUI baseline: a 15-pixel dead zone, analog displacement up to three cells ahead, a 100ms request interval, unchanged-target suppression, and the same nearby free-cell search. The corrected camera projection is retained. The adaptive long-path queue and player acknowledgement wrapper have been removed.

Release immediately stops repeated requests and resets the thumb. Like MobileUI, this does not send a server stop packet or move back to the displayed position; the current short segment can still finish.

During a joystick hold, a plugin-owned wrapper lets the native player walk handler calculate and validate each acknowledged route, then keeps the normal per-cell walk speed for continuing joystick updates. This prevents its repeated timestamp correction from slowing each new first segment. Native relocation, path fallback, forced movement, and unrelated map-click routes retain their original handling. The wrapper is removed on release or player change; no core source files are edited.

Open an inventory/equipment item's information or a learned active skill's description. On touch screens, hold its entry for half a second. Select F1–F9, choose the skill level when applicable, then press **Set shortcut**. Inventory items and skills can also be dragged onto the plugin buttons. Assignment uses the client's normal shortcut change callback and excludes passive or unlearned skills.

Rotate requests fullscreen and switches portrait/landscape when supported. Otherwise, rotate the device manually; the layout follows device orientation.

### Camera gestures

On the game canvas, pinch two fingers to zoom, swipe both fingers horizontally to rotate, swipe vertically to tilt, or twist them to rotate. The mobile-style controls drive the existing camera and retain its indoor limits, zoom limits, and saved settings. Pinch distance is measured from the gesture's start so zoom does not compound while the fingers stand still. Single-finger map taps still use the existing map controls. Joystick, shortcut, and chat touches are excluded from camera gestures.

D-pad movement uses the rendered camera's projected ground plane, including rotation, tilt, and zoom. Skill aim preserves the plugin's separate five-screen-pixels-per-cell, yaw-relative swipe conversion. Desktop mouse camera controls remain available.

### Shortcut targeting

Both F and A rows use the mobile press/drag/release flow with mouse, touch, or pen. Press an offensive or ground skill to aim at the living focused monster, or the nearest monster if none is focused. Friendly targeting starts on the player. Drag from the shortcut to move the aim point from the player using the plugin's camera-relative swipe scale, then release to cast. Entity targets retain the native target validation; ground skills use the selected map tile. Self-only skills execute on press, and items on release.

The first drag movement immediately reanchors the aim to the player, with no added drag threshold or tile snapping. Entity picking uses the plugin's rectangular bounds and list order. The original mobile magic-area and lock-on effects are copied into this folder with distinct class names, preserving selected-level area sizes and range fading without replacing the client's existing effect modules.

To remove an assignment, right-click its shortcut and choose **Clear shortcut**. On touch devices, open any item/skill description, select the F/A slot in its assignment panel, and press **Clear**. This also removes saved bindings for depleted items and sends the normal shortcut change callback.

Pointer cancellation, focus loss, Escape, row switching, map/player changes, and opening a blocking NPC dialog cancel targeting. Keyboard activation retains the normal map-click targeting flow. The plugin changes neither skill packet formats nor the core targeting component.

## Chat

The speech-bubble button opens the mobile-style translucent chat popup. Enter opens and focuses it; Enter or Send submits a message, and Escape closes it. Choose Public, Party, Guild, Clan, or Private; Private also shows a recipient field. GPT is excluded.

The normal ChatBox window is hidden by plugin-owned runtime CSS. Its backend remains responsible for chat packets, slash commands, history, text formatting, and item links. The popup mirrors the native active tab's last 50 rendered entries, retaining its saved filters. No ChatBox source files are changed.

Swipe the message area vertically to scroll. Incoming messages retain the current scroll position while reading older messages; automatic scrolling follows new messages only when already at the bottom. The message list is updated separately from the GUIComponent scrollbar.



The repository ignores plugin subfolders. If committing this plugin, explicitly add its source files with git add -f, excluding node_modules/ and build/.
