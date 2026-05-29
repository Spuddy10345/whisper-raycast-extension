 # Changelog

## [History Improvements] - {PR_MERGE_DATE}

### Added
- **History Size Limit** preference — replaces the hardcoded 100-item cap. Set any positive integer to choose a custom cap, or set to `0` (or leave empty) for unlimited.
- **Save Dictations to History** preference (checkbox, default on) — turn off if you rely on Raycast Clipboard History (Pro) for retroactive access and don't want a duplicated copy in this extension's storage. When off, the Dictation History command will just show whatever was already saved before.
- Dictation History search now matches the full transcription text, not just the first 70 characters of each entry's title. Implemented by passing the full text via `keywords` on each `List.Item` so Raycast's built-in filter sees all of it.

 ## [0.1.0] - 2025-06-05

 ### Added
- Initial release of **Whisper Dictation** extension
  - Local transcription using `whisper.cpp`
  - Download and manage Whisper models within Raycast
  - AI-based refinement via Raycast AI or Ollama/OpenAI-compatible APIs
  - Dictation history with browse, copy, and paste capabilities
  - Configurable default actions (paste, copy, or manual)

## [0.1.1] - {PR_MERGE_DATE}

### Added
- Preference to both copy and paste transcibed text automatically
- Added seperate commands for dictation and dictation with AI refinement
  - This gives more flexibility and how and when each command is called
- Added shortcut to skip refinement for a sesssion during the prompt selection menu (if configured)