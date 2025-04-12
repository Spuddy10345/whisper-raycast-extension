# 🎤 Whisper Dictation for Raycast

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Effortlessly convert your speech to text directly within Raycast using the power of [`whisper.cpp`](https://github.com/ggerganov/whisper.cpp). This extension provides a simple interface to record audio and transcribe it locally. privately on your machine.


    ![Downloading Models](assets/whisper-dictation%202025-04-12%20at%2016.02.17.png)
    ![Recording Audio](assets/whisper-dictation%202025-04-12%20at%2016.02.32.png)
    ![Transcribing Text](assets/whisper-dictation%202025-04-12%20at%2016.03.41.png)

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
2.  **`whisper.cpp`:** You must install whisper-cpp. 
    * The easiest way is to use homebrew: `brew install whisper-cpp`
    * If installed another way make sure to update the path to your whisper-cli executable iin the extension's preferences.
3.  **Whisper Model File:** 
    * Download a model using the `Download Whisper Model`    extesnion command. This will configure the model's path automatically. 
    * Alternatively, download a model yourself (`ggml-{model}.bin`) and point the extension to it's path in preferences.
4.  **`sox`:** This extension uses the SoX (Sound eXchange) utility for audio recording.
    *   The easiest way to install it on macOS is with [Homebrew](https://brew.sh/): `brew install sox`
    *The extension currently default for `sox` to be at `/opt/homebrew/bin/sox`. If yours is installed somewhere else, point the extension to it's executable in preferences.

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

After installing, you have to configure the extension preferences in Raycast, if you installed both SoX and whisper-cpp using homebrew, and download a model using the extension this should all be pre-configured for you, the extension will also confirm both SoX and whisper-cli path on first launch:

1.  Open Raycast Preferences (`⌘ + ,`).
2.  Navigate to `Extensions`.
3.  Find "Whisper Dictation" in the list.
4.  Set the following required preferences:
    *   **Whisper Executable Path:** Enter the *full, absolute path* to your compiled `whisper.cpp` executable (e.g., `/path/to/your/whisper.cpp/build/bin/whisper-cli`).
    * Or if you installed via homebrew on an intel mac: `/usr/local/bin/whisper-cpp`
    *   **Whisper Model Path:** Enter the *full, absolute path* to your downloaded `.bin` model file (e.g., `/path/to/your/whisper.cpp/models/ggml-base.en.bin`).
    * **SoX executable path** Enter the *full, absolute path* to your sox executable
    * For example if you installed SoX using homebrew on an Intel mac you would use:
    * `/usr/local/bin/sox`
    *   **Default Action After Transcription (Optional):** Choose what happens automatically when transcription finishes:
        *   `Paste Text`: Pastes the text into the active application.
        *   `Copy to Clipboard`: Copies the text to the clipboard.
        *   `None (Show Options)`: Shows the transcribed text in Raycast with manual Paste/Copy actions (Default).

## 💡 Usage

1.  **Launch:** Open Raycast and search for the "Dictate Text" command. Press Enter.
2.  **Download a Model** Choose the `Download Whisper Model` command and choose the model you would like to download
* Larger models are more accurate, but also slower and require more ram/processing power
3.  **Record:** Open the `Dictate Text` command. The extension window will appear, showing a "RECORDING AUDIO..." message and a waveform animation. Start speaking clearly.
    *   Press `Enter` when you are finished speaking.
    *   Press `⌘ + .` or click "Cancel Recording" to abort.
4.  **Transcribe:** The view will change to show a loading indicator while `whisper.cpp` processes the audio. This may take a few seconds depending on the audio length and model size.
5.  **Result:**
    *   If transcription is successful, the text area will populate with the dictated text.
    * If there are any mistakes you can modify the text directly within the text box (as long as auto copy/paste isn't active)
    *   Based on your "Default Action" preference:
        *   It might automatically paste or copy, and close Raycast.
        *   Or, it will display the text with actions:
            *   `Paste Text`: Pastes the content.
            *   `Copy Text` (`⌘ + Enter`): Copies the content.
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