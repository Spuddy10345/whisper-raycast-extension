# 🎤 Whisper Dictation for Raycast

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Effortlessly convert your speech to text directly within Raycast using the power of [`whisper.cpp`](https://github.com/ggerganov/whisper.cpp). This extension provides a simple interface to record audio and transcribe it locally. privately on your machine.

<!-- TODO: Add a GIF demo here! Showing the recording process and the result would be very helpful. -->
<!-- Example: <p align="center"><img src="link/to/your/demo.gif" width="600"></p> -->

## ✨ Features

*   **Local Transcription:** Uses `whisper.cpp` running locally on your machine through Raycast.
*   **Simple Interface:** Start recording, press Enter to stop, copy or directly paste into your active window.
*   **Configurable Output:** Choose to choose, or automatically paste or copy to clipboard. 

## 📚 Table of Contents

*   [Features](#-features)
*   [Requirements](#-requirements)
*   [Installation](#-installation)
    *   [1. Prerequisites](#1-prerequisites)
    *   [2. Install the Extension](#2-install-the-extension)
*   [Configuration](#️-configuration)
*   [Usage](#-usage)
*   [Troubleshooting](#-troubleshooting)
*   [Contributing](#-contributing)
*   [License](#-license)
*   [Acknowledgements](#-acknowledgements)

## ⚠️ Requirements

Before installing the extension, you need the following installed and configured on your system:

1.  **Raycast:** You need the Raycast app installed.
2.  **`whisper.cpp`:** You must compile the `whisper.cpp` project yourself.
    *   Clone the repository: `git clone https://github.com/ggerganov/whisper.cpp.git`
    *   Follow their instructions to build the project (e.g., using `make`). You specifically need the `main` executable (or potentially `whisper-cli` depending on the build options/version you use). Note the *full path* to this executable.
3.  **Whisper Model File:** Download a `whisper.cpp`-compatible model file (usually ending in `.bin`).
    *   Models can be found linked in the `whisper.cpp` repository documentation. Common sizes include `tiny`, `base`, `small`, `medium`, `large`. Smaller models are faster but less accurate. Choose one (e.g., `ggml-base.en.bin` for English base model) and note its *full path*.
4.  **`sox`:** This extension uses the SoX (Sound eXchange) utility for audio recording.
    *   The easiest way to install it on macOS is with [Homebrew](https://brew.sh/): `brew install sox`
    *   The extension currently expects `sox` to be at `/opt/homebrew/bin/sox`. If yours is installed somewhere else, change the path *within the extension's code* (`dictate.tsx`) or use a sym-link.

## 🚀 Installation

### 1. Prerequisites

This installation assumes you have met all requirements posted above [Requirements](#-requirements). Have the full paths to your `whisper.cpp` executable and the downloaded model file ready. 

### 2. Install the Extension

Since this extension isn't on the Raycast Store (yet!), you'll install it from the source code:

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/whisper-raycast-extension.git 
    cd whisper-raycast-extension
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Build the Extension:**
    ```bash
    npm run build
    ```
    Alternatively, for development: `npm run dev`
4.  **Open Raycast Preferences:** Go to `Extensions` > `+` (Add Extension) > `Import Extension...`.
5.  **Select Directory:** Navigate to and select the cloned `whisper-raycast-extension` directory.
6.  **Configure:** Follow the steps in the [Configuration](#️-configuration) section below.

## ⚙️ Configuration

After installing, you have to configure the extension preferences in Raycast:

1.  Open Raycast Preferences (`⌘ + ,`).
2.  Navigate to `Extensions`.
3.  Find "Whisper Dictation" in the list.
4.  Set the following required preferences:
    *   **Whisper Executable Path:** Enter the *full, absolute path* to your compiled `whisper.cpp` executable (e.g., `/path/to/your/whisper.cpp/build/bin/whisper-cli`).
    *   **Whisper Model Path:** Enter the *full, absolute path* to your downloaded `.bin` model file (e.g., `/path/to/your/whisper.cpp/models/ggml-base.en.bin`).
    *   **Default Action After Transcription (Optional):** Choose what happens automatically when transcription finishes:
        *   `Paste Text`: Pastes the text into the active application.
        *   `Copy to Clipboard`: Copies the text to the clipboard.
        *   `None (Show Options)`: Shows the transcribed text in Raycast with manual Paste/Copy actions (Default).

## 💡 Usage

1.  **Launch:** Open Raycast and search for the "Dictate Text" command. Press Enter.
2.  **Record:** The extension window will appear, showing a "RECORDING AUDIO..." message and a waveform animation. Start speaking clearly.
    *   Press `Enter` when you are finished speaking.
    *   Press `⌘ + .` or click "Cancel Recording" to abort.
3.  **Transcribe:** The view will change to show a loading indicator while `whisper.cpp` processes the audio. This may take a few seconds depending on the audio length and model size.
4.  **Result:**
    *   If transcription is successful, the text area will populate with the dictated text.
    *   Based on your "Default Action" preference:
        *   It might automatically paste or copy, and close Raycast.
        *   Or, it will display the text with actions:
            *   `Paste Text`: Pastes the content.
            *   `Copy Text` (`⌘ + Enter`): Copies the content.
            *   `Start New Dictation`: Resets the state (you'll need to close and reopen the command currently).
            *   `Close` (`Esc`): Closes the Raycast window.
    *   If an error occurs during recording or transcription, an error message will be displayed.

## 🐛 Troubleshooting

*   **"Command failed to start" / Sox Errors:**
    *   Verify `sox` is installed correctly (`brew install sox`).
    *   Check if the path `/opt/homebrew/bin/sox` is correct for your installation. If not, you may need to edit `dictate.tsx` or create a symlink.
    *   Ensure Raycast (or your terminal if running `sox` manually) has microphone permissions in System Settings > Privacy & Security > Microphone.
*   **"Transcription failed" / Whisper Errors:**
    *   Double-check the "Whisper Executable Path" in preferences. Ensure it's the correct, full path to the *executable file* (not just the directory).
    *   Double-check the "Whisper Model Path" in preferences. Ensure it's the correct, full path to the `.bin` file.
    *   Verify file permissions for both the executable and the model file. They need to be readable and executable (for the `main` binary).
    *   Ensure the model file is compatible with your compiled version of `whisper.cpp`.
    *   Check the Raycast Console for more detailed error messages (Open Raycast > `Developer Tools` > `Show Extension Logs`).
*   **No Audio Recorded / Poor Quality:**
    *   Check your microphone input level in System Settings > Sound > Input.
    *   Ensure the correct microphone is selected as the default input device.
*   **Extension doesn't appear:**
    *   Ensure you ran `npm install` and `npm run build` in the extension directory.
    *   Try removing and re-importing the extension in Raycast preferences.

## 🙏 Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue on the GitHub repository. If you'd like to contribute code, please open a Pull Request.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details (or state MIT directly if no file exists).

## ❤️ Acknowledgements

*   [Georgi Gerganov](https://github.com/ggerganov) for the amazing [`whisper.cpp`](https://github.com/ggerganov/whisper.cpp) project.
*   The [Raycast](https://raycast.com/) team for the fantastic platform and API.
*   [SoX - Sound eXchange](http://sox.sourceforge.net/) developers.

---