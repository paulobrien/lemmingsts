# Agent instructions

- Keep original game files in `dos/lemmings/` private and out of Git. Do not stage or commit them, or copies of proprietary game data.
- Deploy application updates to both existing sites unless the user asks otherwise: Vanessa's public play site includes the user-provided game files, while the original public preview must contain no game files. Preserve each site's audience and bundle distinction. Obtain site destinations from the hosting service; keep deployment URLs and credentials out of Git and downloadable source archives. Never push original game data to either site's source repository or include it in the downloadable source archive.
- Stage and commit completed work in sensible, cohesive chunks. Use clear commit messages that explain the change and its purpose; review staged changes before committing.
- Add or update automated tests when they meaningfully protect changed behaviour, and run the checks appropriate to each change. Report any checks that could not be run.
