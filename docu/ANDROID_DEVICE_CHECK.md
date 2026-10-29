# Android device check

The browser tests emulate phone and tablet viewports; they do not establish how the installed app behaves on physical Android devices. Run this check once on the intended phone and once on the tablet, using the public HTTPS preview in Chrome. Record the device model, Android and Chrome versions, date and any problems observed.

1. Transfer an unencrypted ZIP of your own original DOS files to the device privately. Open the preview, choose **Add your game files**, select the ZIP and confirm that the import succeeds. The files and progress are local to this browser.
2. Use Chrome's **Install app** or **Add to Home screen** command and launch the installed app from its icon. Confirm that it opens in its own window and still sees the imported files.
3. Start a level and check tapping lemmings, selecting skills, panning and zooming in portrait and landscape. Enter fullscreen and check that the level, skills and hints remain usable; exit from the pause menu and check the browser's Back gesture. If native fullscreen is unavailable, confirm the expanded view and its exit control work. Pause and resume, switch apps and return, then complete a level and check that progress remains after reopening.
4. Turn music and sound on and check playback after a tap, pause, resume and reopening. Try headphones or the device's usual output if relevant. Sound and music start off by default.
5. While online, load the app and a level so the app shell is cached. Close it, turn on airplane mode, reopen the installed app and play the imported level. Re-enable connectivity afterward.
6. After an update is published, reopen online and check the app still starts, retains its local data and can subsequently launch offline. If anything fails, record the exact action and visible error before clearing site data or reinstalling.

The public site must never contain the original game files. Clearing browser storage or uninstalling can remove the local files and progress; import them again if needed. Progress does not sync between devices.
