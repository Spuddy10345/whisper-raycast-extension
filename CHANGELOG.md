 # Changelog

## [Dictate (No Punctuation) command] - {PR_MERGE_DATE}

### Added
- New **`Dictate (No Punctuation)`** command for casual transcription. Same recording flow as the regular Dictate command, but the result is lowercased and stripped of sentence punctuation (`. , ; : ! ? " ( ) [ ] { }` and em/en dashes / smart quotes). ASCII apostrophes (for contractions like `don't`) and hyphens (for compound words like `well-known`) are preserved. AI refinement is intentionally bypassed in this mode — to keep the output raw. Assign your own keyboard shortcut to it via Raycast Settings > Extensions > Whisper Dictation > Dictate (No Punctuation).
- New optional `transformText` parameter on the internal `useTranscription` hook, applied after AI refinement and before the result is set, saved, or pasted. Existing commands don't pass it, so behavior is unchanged for them.

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