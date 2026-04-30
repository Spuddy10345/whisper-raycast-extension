 # Changelog

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

## [Configurable Waveform Width] - {PR_MERGE_DATE}

### Added
- New `Waveform Width` preference (dropdown of presets: 50 / 60 / 70 / 80 / 90 / 105 / Custom) to control the width of the recording waveform animation. Pick a smaller value if the animation wraps onto multiple lines for your Raycast window mode/text size combination.
- New `Custom Waveform Width` preference (text field) for users who want an exact value outside the presets. Used only when `Waveform Width` is set to `Custom`. Falls back to 70 on invalid input.

### Changed
- Default waveform width reduced from 105 to 70 characters so the animation fits a default-width Raycast window without wrapping. Users who prefer the original look can select `105 (Original)` in preferences.
- Recording header switches to a shorter `RECORDING (Enter to stop)` label for waveform widths below 40 columns so it doesn't overflow the visualizer area on very narrow custom widths.

### Performance
- Waveform renderer hoists the per-column base-amplitude curve into a `useMemo` keyed on `waveformWidth` and precomputes the per-column normalized amplitude once per frame instead of inside the per-cell loop. Cuts `Math.sin` calls per frame from `4 × width × height` to `width` (~72× fewer at default settings) and removes redundant work from the inner loop.