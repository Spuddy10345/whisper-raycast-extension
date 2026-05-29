 # Changelog

## [Whisper Engine Preferences] - {PR_MERGE_DATE}

### Added
- **Language** preference — pass a specific ISO 639-1 code to `whisper-cli` (`-l`) instead of always auto-detecting. Forcing the correct language usually beats auto-detect on short clips. Defaults to `auto`.
- **CPU Threads** preference — pass a thread count to `whisper-cli` (`-t`). Leave empty for the whisper.cpp default. Useful for tuning transcription speed vs system responsiveness.
- **Initial Prompt** preference — pass an initial prompt to `whisper-cli` (`--prompt`) to bias transcription toward specific vocabulary, punctuation, or style. Distinct from AI refinement — this happens inside Whisper itself, before transcription completes.
- **Translate to English** preference — pass `--translate` to `whisper-cli` so the output is English translation rather than source-language transcription.

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