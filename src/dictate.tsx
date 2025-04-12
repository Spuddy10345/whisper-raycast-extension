import {
  ActionPanel,
  Form,
  Action,
  showToast,
  Toast,
  closeMainWindow,
  Icon,
  Detail,
  getPreferenceValues,
  Clipboard,
  environment,
  LocalStorage,
  launchCommand,
  LaunchType,
  showHUD,
  openExtensionPreferences,
  PopToRootType,
} from "@raycast/api";
import { useState, useEffect, useRef, useCallback } from "react";
import { spawn, exec } from "child_process";
import type { ChildProcessWithoutNullStreams } from "child_process";
import path from 'path';
import fs from 'fs';
import { showFailureToast } from "@raycast/utils"; 

interface Preferences {
  whisperExecutable: string;
  modelPath: string;
  soxExecutablePath: string;
  defaultAction: "paste" | "copy" | "none";
}

// Paths
const AUDIO_FILE_PATH = path.join(environment.supportPath, "raycast_dictate_audio.wav"); 
const DOWNLOADED_MODEL_PATH_KEY = "downloadedModelPath";
const preferences = getPreferenceValues<Preferences>();

// Define states
type CommandState = "configuring" | "idle" | "recording" | "transcribing" | "done" | "error";
interface Config {
  execPath: string;
  modelPath: string;
  soxPath: string;
}

export default function Command() {
  const [state, setState] = useState<CommandState>("configuring");
  const [transcribedText, setTranscribedText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const soxProcessRef = useRef<ChildProcessWithoutNullStreams | null>(null);
  const [waveformSeed, setWaveformSeed] = useState<number>(0);
  const [config, setConfig] = useState<Config | null>(null); 

  const preferences = getPreferenceValues<Preferences>();
  const DEFAULT_ACTION = preferences.defaultAction || "none";

  // Cleanup function for Sox process and audio file
  const cleanupSoxProcess = useCallback(() => {
    if (soxProcessRef.current) {
      console.log("Cleaning up sox process...");
      if (!soxProcessRef.current.killed) {
        try {
          // Attempt graceful shutdown 
          process.kill(soxProcessRef.current.pid!, "SIGTERM"); 
          console.log(`Sent SIGTERM to PID ${soxProcessRef.current.pid}`);
        } catch (e) {
          console.warn("Error sending SIGTERM/SIGKILL", e);
        }
      }
      soxProcessRef.current = null;
    }
    // Clean up audio file using fs.promises for async/await pattern
    fs.promises.unlink(AUDIO_FILE_PATH)
      .then(() => console.log("Cleaned up audio file."))
      .catch((err) => {
          if (err.code !== 'ENOENT') {
             console.error("Error cleaning up audio file:", err.message);
          }
      });
  }, []); 

  // Effect for checking config (exec and model path)
  useEffect(() => {
    let isMounted = true;
  
    async function checkConfiguration() {
      if (!isMounted) return;
      setState("configuring");
      console.log("Starting configuration check...");
  
      // Read all prefs
      const prefs = getPreferenceValues<Preferences>();
      let whisperExecPath = prefs.whisperExecutable;
      let modelOverridePath = prefs.modelPath;
      let soxPath = prefs.soxExecutablePath; // Get SoX path from prefs
  
      // Validate sox path
      if (!soxPath || !fs.existsSync(soxPath)) {
         console.error(`SoX executable check failed: '${soxPath}'`);
         const errorMsg = `SoX executable not found or not set at '${soxPath || "not set"}'. Please install SoX (e.g., 'brew install sox') and set the correct path in preferences.`;
         setErrorMessage(errorMsg);
         if (isMounted) setState("error");
         await showFailureToast(errorMsg, {
             title: "SoX Executable Not Found",
             primaryAction: {
                 title: "Open Extension Preferences",
                 onAction: () => openExtensionPreferences(),
             }
         });
         return; // Stop config check
      }
      console.log("Using SoX executable:", soxPath);
  
      // Validate whisper-cli path
      if (!whisperExecPath || !fs.existsSync(whisperExecPath)) {
        console.error(`Whisper executable check failed: '${whisperExecPath}'`);
        const errorMsg = `Whisper executable not found at '${whisperExecPath || "not set"}'. \n\nEnsure whisper.cpp is installed and the path in preferences is correct. \nCommon paths:\n- Homebrew (Apple Silicon): /opt/homebrew/bin/whisper-cli\n- Homebrew (Intel): /usr/local/bin/whisper-cli`;
        setErrorMessage(errorMsg);
        if (isMounted) setState("error");
        await showFailureToast(errorMsg, {
            title: "Whisper Executable Not Found",
            primaryAction: {
                title: "Open Extension Preferences",
                onAction: () => openExtensionPreferences(),
            }
        });
        return;
      }
      console.log("Using Whisper executable:", whisperExecPath);
  
      // Get model path
      let finalModelPath = "";
      try {
        const downloadedPath = await LocalStorage.getItem<string>(DOWNLOADED_MODEL_PATH_KEY);
  
        console.log("Pref Model Override Path:", modelOverridePath);
        console.log("Downloaded Model Path:", downloadedPath);
  
        // Prioritize Preference Path
        if (modelOverridePath && fs.existsSync(modelOverridePath)) {
          console.log("Using preference override model path:", modelOverridePath);
          finalModelPath = modelOverridePath;
        } else if (downloadedPath && fs.existsSync(downloadedPath)) {
          console.log("Using downloaded model path:", downloadedPath);
          finalModelPath = downloadedPath;
        } else {
          console.error("No valid Whisper model found. Checked Pref Override:", modelOverridePath, "Checked LocalStorage:", downloadedPath);
          const errorMsg = "No Whisper model found. Please run the 'Download Whisper Model' command or configure the path override in preferences.";
          setErrorMessage(errorMsg);
          if (isMounted) setState("error");
          await showFailureToast(errorMsg, {
              title: "Whisper Model Not Found",
              primaryAction: {
                 title: "Download Model",
                 onAction: async () => {
                     await launchCommand({ name: "download-model", type: LaunchType.UserInitiated });
                     closeMainWindow(); // Close command after launching downloader
                 }
              }
          });
          return;
        }
      } catch (error) {
        console.error("Failed to determine model path:", error);
        const errorMsg = "Error accessing configuration. Check console logs.";
        setErrorMessage(errorMsg);
        if (isMounted) setState("error");
        await showFailureToast(errorMsg, { title: "Configuration Error" });
        return;
      }
  
      // Config Successful
      console.log("Configuration successful:", { whisperExecPath, finalModelPath, soxPath });
      if (isMounted) {
          // Set full config
          setConfig({ execPath: whisperExecPath, modelPath: finalModelPath, soxPath: soxPath });
          setErrorMessage("");
          setState("idle");
      }
    }
  
    checkConfiguration();

    // Cleanup function for effect
    return () => {
        isMounted = false;
        console.log("checkConfiguration effect cleanup");
    };
    // Rerun on preference change
  }, [preferences.whisperExecutable, preferences.modelPath, preferences.soxExecutablePath]);
  


  // Effect to Start/Stop Recording 
   useEffect(() => {
    let isMounted = true; // Track mounted state 

    if (state === "idle" && config) {
      // Ensure dir for audio file exists
      const audioDir = path.dirname(AUDIO_FILE_PATH);
      fs.promises.mkdir(audioDir, { recursive: true })
          .then(() => {
              if (!isMounted) return; // Check mount status after async 
              console.log("Configuration ready, starting recording.");
              setState("recording"); 
              showToast({ style: Toast.Style.Animated, title: "Recording...", message: "Press Enter to stop" });

              fs.promises.mkdir(path.dirname(AUDIO_FILE_PATH), { recursive: true })
              .then(() => {
                  // spawn sox process 
                  const args = [
                     "-d", // Default device
                     "-t", "wav", // Output WAV
                     "--channels", "1", // Mono 
                     "--rate", "16000", // Sample rate for whisper
                     "--encoding", "signed-integer", // 16-bit PCM
                     "--bits", "16",
                     AUDIO_FILE_PATH,
                   ];
                  let process: ChildProcessWithoutNullStreams | null = null;
                  try {
                     process = spawn(config.soxPath, args);
                     soxProcessRef.current = process;
                     console.log(`Spawned sox process with PID: ${process.pid}`);
                  } catch (err: any) {
                     console.error("sox spawn synchronous error:", err);
                     setErrorMessage(`Failed to start recording command. Error: ${err.message}`);
                     if (isMounted) setState("error");
                     return; // Return from inner .then callback
                  }

                  process.on('error', (err) => {
                     console.error(`sox process PID ${process?.pid} error event:`, err);
                     soxProcessRef.current = null; // Clear ref on error
                  });

                  process.stderr.on('data', (data) => {
                     console.log(`sox stderr PID ${process?.pid}: ${data.toString()}`);
                  });

                  process.on('close', (code, signal) => {
                     console.log(`sox process PID ${process?.pid} closed. Code: ${code}, Signal: ${signal}`);
                     if (soxProcessRef.current === process) {
                      soxProcessRef.current = null;
                      console.log("Cleared sox process ref due to close event.");
                     }
                  });
               }) 
              .catch(err => { 
                 console.error("Error creating specific audio file directory:", err);
                 if (isMounted) {
                    setErrorMessage(`Failed to prepare audio file directory: ${err.message}`);
                    setState("error");
                 }
              }); 
           }) 
          .catch(err => { 
             console.error("Error creating base audio directory:", err);
             if (isMounted) {
                setErrorMessage(`Failed to prepare base audio directory: ${err.message}`);
                setState("error");
             }
          }); 
    } 

    //Ensure process is stopped if component unmounts or dependencies change
    return () => {
      isMounted = false; // Mark as unmounted
      console.log(`useEffect [state, config] cleanup. State during cleanup: ${state}`);
  
      // Only stop process if still referenced and not been killed
      if (soxProcessRef.current) {
        const processToCleanup = soxProcessRef.current;
        console.log(`useEffect cleanup: Attempting to stop lingering sox process PID ${processToCleanup.pid}`);
        soxProcessRef.current = null; // Clear ref
        if (!processToCleanup.killed) {
          try {
            //SIGKILL to ensure killed as last resort
            process.kill(processToCleanup.pid!, "SIGKILL");
            console.log(`useEffect cleanup: Sent SIGKILL to PID ${processToCleanup.pid}`);
          } catch (e) {
            // Ignore errors like 'process already exited'
            if (e instanceof Error && 'code' in e && e.code !== 'ESRCH') {
               console.warn(`useEffect cleanup: Error sending SIGKILL to PID ${processToCleanup.pid}:`, e);
            }
          }
        }
      } else {
          console.log("useEffect cleanup: No active sox process ref found.");
      }
    };
  }, [state, config, cleanupSoxProcess]);

  // Effect for waveform animation
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (state === "recording") {
      intervalId = setInterval(() => {
        setWaveformSeed(prev => prev + 1);
      }, 150);
    }
    // Cleanup interval on unmount or when state changes
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [state]);

  const stopRecordingAndTranscribe = useCallback(async () => {
    // Use the current state value directly from the hook
    console.log(`stopRecordingAndTranscribe called. Current state: ${state}`);

    if (state !== "recording") {
      console.warn(`stopRecordingAndTranscribe: State is '${state}', expected 'recording'. Aborting.`);
      return;
    }

    if (!config) {
      console.error("stopRecordingAndTranscribe: Configuration not available.");
      setErrorMessage("Configuration error occurred before transcription.");
      setState("error");
      return;
    }

    // Capture current process reference 
    const processToStop = soxProcessRef.current;

    // Move to transcribing state
    setState("transcribing");
    showToast({ style: Toast.Style.Animated, title: "Transcribing..." });
    console.log("Set state to transcribing.");

    // Stop sox process if running
    if (processToStop) {
        console.log(`Attempting to stop recording process PID: ${processToStop.pid}...`);
        soxProcessRef.current = null; // Clear ref, or else...
        console.log("Cleared sox process ref.");
        try {
           if (!processToStop.killed) {
               process.kill(processToStop.pid!, "SIGTERM"); 
               console.log(`Sent SIGTERM to PID ${processToStop.pid}`);
           } else {
              console.log(`Process ${processToStop.pid} was already killed.`);
           }
        } catch (e) {
          console.warn(`Error stopping sox process PID ${processToStop.pid}:`, e);
          // Transcribe even if stopping fails
        }
    } else {
         console.warn("stopRecordingAndTranscribe: No active sox process reference found to stop.");
    }


    //delay to ensure audio file written
    await new Promise(resolve => setTimeout(resolve, 400)); 

    console.log(`Checking for audio file: ${AUDIO_FILE_PATH}`);

    try {
      const stats = await fs.promises.stat(AUDIO_FILE_PATH);
      console.log(`Audio file stats: ${JSON.stringify(stats)}`);
      
      // Check if file exists and has expected size (e.g., > 44 bytes for WAV header)
      if (stats.size <= 44) {
        throw new Error(`Audio file is empty or too small (size: ${stats.size} bytes). Recording might have failed or captured no sound.`);
      }
      
      console.log(`Audio file exists and has size ${stats.size}. Proceeding with transcription.`);
    } catch (fileError: any) {
      console.error(`Audio file check failed: ${AUDIO_FILE_PATH}`, fileError);
      // specific error message based on the error code
      const errorMsg = fileError.code === 'ENOENT'
        ? `Transcription failed: Audio file not found. Recording might have failed.`
        : `Transcription failed: Cannot access audio file. ${fileError.message}`;
      setErrorMessage(errorMsg);
      setState("error");
      cleanupSoxProcess(); 
      return;
    }

    console.log(`Starting transcription with model: ${config.modelPath}`);

    // Execute whisper-cli
    exec(
      `"${config.execPath}" -m "${config.modelPath}" -f "${AUDIO_FILE_PATH}" -l auto -otxt --no-timestamps`, 
      async (error, stdout, stderr) => {
        // Always clean up audio file after exec finishes
        cleanupSoxProcess();

        if (error) {
          console.error("whisper error:", error);
          console.error("whisper stderr:", stderr);
          const errMsg = stderr?.includes("invalid model") ? `Invalid or incompatible model file: ${config.modelPath}` :
                         stderr?.includes("failed to load model") ? `Failed to load model: ${config.modelPath}` :
                         `Transcription failed: ${stderr || error.message}`;
          setErrorMessage(errMsg);
          setState("error");
        } else {
          console.log("Transcription successful.");
          const trimmedText = stdout.trim();
          setTranscribedText(trimmedText);
          setState("done");

          await handleTranscriptionComplete(trimmedText);
        }
      }
    );
  }, [state, config, cleanupSoxProcess]);


  const generateWaveformMarkdown = useCallback(() => {
    const waveformHeight = 18;
    const waveformWidth = 105;
    let waveform = "```\n"; // Start md code block
    waveform += "RECORDING AUDIO... PRESS ENTER TO STOP\n\n"; 

    for (let y = 0; y < waveformHeight; y++) {
      let line = "";
      for (let x = 0; x < waveformWidth; x++) {
        const baseAmplitude1 = Math.sin((x / waveformWidth) * Math.PI * 4) * 0.3;
        const baseAmplitude2 = Math.sin((x / waveformWidth) * Math.PI * 8) * 0.15;
        const baseAmplitude3 = Math.sin((x / waveformWidth) * Math.PI * 2) * 0.25;
        const baseAmplitude = baseAmplitude1 + baseAmplitude2 + baseAmplitude3;
        const randomFactor = Math.sin(x + waveformSeed * 0.3) * 0.2;
        const amplitude = baseAmplitude + randomFactor;
        const normalizedAmplitude = (amplitude + 0.7) * waveformHeight * 0.5;
        const distFromCenter = Math.abs(y - waveformHeight / 2);
        const shouldDraw = distFromCenter < normalizedAmplitude;

        if (shouldDraw) {
          const intensity = 1 - (distFromCenter / normalizedAmplitude);
          if (intensity > 0.8) line += "█";
          else if (intensity > 0.6) line += "▓";
          else if (intensity > 0.4) line += "▒";
          else if (intensity > 0.2) line += "░";
          else line += "·";
        } else {
          line += " ";
        }
      }
      waveform += line + "\n";
    }
    waveform += "```"; // End md code block
    return waveform;
  }, [waveformSeed]);

  const handleTranscriptionComplete = useCallback(async (text: string) => {
    cleanupSoxProcess(); // Ensure cleanup happens *before* potential closeMainWindow

    // Prefs to copy/paste immediately
    if (DEFAULT_ACTION === "paste") {
      await Clipboard.paste(text);
      await showHUD("Pasted transcribed text"); 
      await closeMainWindow({ clearRootSearch: true, popToRootType: PopToRootType.Immediate });
    } else if (DEFAULT_ACTION === "copy") {
      await Clipboard.copy(text);
      await showHUD("Copied to clipboard");
      await closeMainWindow({ clearRootSearch: true, popToRootType: PopToRootType.Immediate });
    } else {
      // Action is "none", stay in "done" state
      showToast({ style: Toast.Style.Success, title: "Transcription complete" });
    }
  }, [DEFAULT_ACTION, cleanupSoxProcess]);


  const getActionPanel = useCallback(() => {
    switch (state) {
      case "recording":
        return (
          <ActionPanel>
            {/* Use callback directly */}
            <Action title="Stop and Transcribe" icon={Icon.Stop} onAction={stopRecordingAndTranscribe} />
            <Action title="Cancel Recording" icon={Icon.XMarkCircle} shortcut={{ modifiers: ["cmd"], key: "." }} onAction={() => {
               cleanupSoxProcess();
               closeMainWindow();
            }}/>
          </ActionPanel>
        );
      case "done":
        return (
          <ActionPanel>
            <Action.Paste
              title={DEFAULT_ACTION === "paste" ? "Paste Text (Default)" : "Paste Text"}
              content={transcribedText}
              onPaste={() => closeMainWindow({ clearRootSearch: true })} // Close after paste
            />
            <Action.CopyToClipboard
              title={DEFAULT_ACTION === "copy" ? "Copy Text (Default)" : "Copy Text"}
              content={transcribedText}
              shortcut={{ modifiers: ["cmd"], key: "enter" }}
              onCopy={() => closeMainWindow({ clearRootSearch: true })} // Close after copy
            />
            <Action title="Close" icon={Icon.XMarkCircle} onAction={closeMainWindow} />
          </ActionPanel>
        );
      case "transcribing":
        // No actions available during transcription
         return null; 
      case "error":
         return (
           <ActionPanel>
              {/* Allow to quickly open preferences if config error */}
              <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
              <Action title="Retry (Reopen Command)" icon={Icon.ArrowClockwise} onAction={() => {
                   closeMainWindow();
                   showHUD("Please reopen the Dictate Text command.");
               }}/>
               <Action title="Download Model" icon={Icon.Download} onAction={async () => {
                   await launchCommand({ name: "download-model", type: LaunchType.UserInitiated });
                   closeMainWindow();
               }}/>
              <Action title="Close" icon={Icon.XMarkCircle} onAction={closeMainWindow} />
           </ActionPanel>
         );
      default: // idle, configuring
        return (
           <ActionPanel>
              <Action title="Close" icon={Icon.XMarkCircle} onAction={closeMainWindow} />
           </ActionPanel>
        );
    }
  }, [state, stopRecordingAndTranscribe, transcribedText, cleanupSoxProcess, DEFAULT_ACTION]);

  if (state === "configuring") {
    // while checking config, show loading
    return <Detail isLoading={true} markdown={"Checking Whisper configuration..."} />;
  }

  if (state === "recording") {
    // Show waveform while recording
    return (
      <Detail
        markdown={generateWaveformMarkdown()}
        actions={getActionPanel()}
      />
    );
  }

  //Dictation UI
  return (
    <Form
      isLoading={state === "transcribing"}
      actions={getActionPanel()}
      // Add navigationTitle based on state for clarity
      navigationTitle={
         state === "transcribing" ? "Transcribing..." :
         state === "done" ? "Transcription Result" :
         state === "error" ? "Error" :
         "Whisper Dictation"
      }
    >
      {state === "error" && (
           <Form.Description title="Error" text={errorMessage} />
      )}
       {(state === "done" || state === "transcribing" || state === 'idle') && ( 
          <Form.TextArea
            id="dictatedText"
            title={state === 'done' ? "Dictated Text" : ""} // Hide title unless done
            placeholder={
                state === 'transcribing' ? "Transcribing audio..." :
                state === 'done' ? "Transcription result" :
                "Waiting to start..." // idle state text
            }
            value={state === 'done' ? transcribedText : ""} // Only show text when done
            onChange={setTranscribedText} 
          />
       )}
       {state === 'transcribing' && (
           <Form.Description text="Processing audio, please wait..." />
       )}
    </Form>
  );
}