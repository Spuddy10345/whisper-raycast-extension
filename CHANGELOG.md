 # Changelog

## [Named AI Providers] - {PR_MERGE_DATE}

### Added
- **OpenAI**, **Anthropic**, and **OpenRouter** as explicit options in the `AI Refinement Method` dropdown. Pick one, provide your API key, and pick a model — the extension uses the right endpoint automatically. No need to figure out base URLs.

### Changed
- The previous `Ollama/External API` option is now labeled `Ollama / Custom OpenAI-compatible` to reflect that it covers any user-provided OpenAI v1 endpoint.
- `Custom API Endpoint` (formerly `Ollama/API Endpoint`) and related field labels/descriptions clarified — endpoint is only consulted for the Ollama/Custom option; the named providers use built-in endpoints.
- Renamed internal helper `refineWithOllama` to `refineWithOpenAICompatible` since it now serves four providers. Error and status messages interpolate the actual provider name instead of always saying "Ollama".

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