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
  environment,
  LocalStorage,
  launchCommand,
  LaunchType,
  showHUD,
  openExtensionPreferences,
  PopToRootType,
} from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import type { ChildProcessWithoutNullStreams } from "child_process";
import path from 'path';
import fs from 'fs';
import crypto from "crypto";
// Import custom hooks
import { useConfiguration } from "./hooks/useConfiguration";
import { useRecording } from "./hooks/useRecording";
import { useTranscription } from "./hooks/useTranscription";
import { useAIRefinement } from "./hooks/useAIRefinement"; 

interface Preferences {
  whisperExecutable: string;
  modelPath: string;
  soxExecutablePath: string;
  defaultAction: "paste" | "copy" | "none";
  aiRefinementMethod: "disabled" | "raycast" | "ollama";
  aiModel: string;
  ollamaEndpoint: string;
  ollamaApiKey: string;
  ollamaModel: string;
}

interface TranscriptionHistoryItem {
  id: string;
  timestamp: number;
  text: string;
}

// Paths
const AUDIO_FILE_PATH = path.join(environment.supportPath, "raycast_dictate_audio.wav");
const HISTORY_STORAGE_KEY = "dictationHistory";

const AI_PROMPTS_KEY = "aiPrompts";
interface AIPrompt {
  id: string;
  name: string;
  prompt: string;
}

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
  const [aiErrorMessage, setAiErrorMessage] = useState<string>("");
  const soxProcessRef = useRef<ChildProcessWithoutNullStreams | null>(null);
  const [waveformSeed, setWaveformSeed] = useState<number>(0);
  const [config, setConfig] = useState<Config | null>(null);

  const preferences = getPreferenceValues<Preferences>();
  const DEFAULT_ACTION = preferences.defaultAction || "none";
  const [prompts] = useCachedState<AIPrompt[]>(AI_PROMPTS_KEY, []);

  // Get refineText function from hook 
  const { refineText } = useAIRefinement(setAiErrorMessage);

  // Cleanup function for audio file only
  const cleanupAudioFile = useCallback(() => {
    fs.promises
      .unlink(AUDIO_FILE_PATH)
      .then(() => console.log("Cleaned up audio file."))
      .catch((err) => {
        if (err.code !== "ENOENT") {
          // Ignore if file doesn't exist
             console.error("Error cleaning up audio file:", err.message);
          }
      });
  }, []);

  // Initialize and validate configuration
  useConfiguration(setState, setConfig, setErrorMessage);

  const { restartRecording, currentRefinementPrompt, isRefinementActive } = useRecording(
    state,
    config,
    setState,
    setErrorMessage,
    soxProcessRef
  );

  // Effect for waveform animation
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (state === "recording") {
      intervalId = setInterval(() => {
        setWaveformSeed((prev) => prev + 1);
      }, 150);
    }
    // Cleanup interval on unmount or when state changes
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [state]);

  const saveTranscriptionToHistory = useCallback(async (text: string) => {
    // Don't save empty transcription
    if (!text || text === "[BLANK_AUDIO]" || text === "[PAUSE]") return;

    try {
      const newItem: TranscriptionHistoryItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        text: text,
      };

      const existingHistoryString = await LocalStorage.getItem<string>(HISTORY_STORAGE_KEY);
      let history: TranscriptionHistoryItem[] = [];

      if (existingHistoryString) {
        try {
          history = JSON.parse(existingHistoryString);
          if (!Array.isArray(history)) {
             console.warn("Invalid history data found in LocalStorage, resetting.");
             history = [];
          }
        } catch (parseError) {
          console.error("Failed to parse history from LocalStorage:", parseError);
          await showToast({
            style: Toast.Style.Failure,
            title: "Warning",
            message: "Could not read previous dictation history. Clearing history.",
          });
          history = []; // Reset history if parse fails
        }
      }

      // Add new item to beginning
      history.unshift(newItem);

      // Limit history size
      const MAX_HISTORY_ITEMS = 100;
      if (history.length > MAX_HISTORY_ITEMS) {
         history = history.slice(0, MAX_HISTORY_ITEMS);
      }

      await LocalStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
      console.log("Saved transcription to history.");
    } catch (error) {
      console.error("Failed to save transcription to history:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: "Failed to save transcription to history.",
      });
    }
  }, []);

  // Use transcription hook
  const { startTranscription } = useTranscription({
    config,
    preferences,
    setState,
    setErrorMessage,
    setTranscribedText,
    refineText,
    saveTranscriptionToHistory,
    cleanupAudioFile,
    aiErrorMessage, 
  });

  // Function to stop recording and transcribe via hook
  const stopRecordingAndTranscribe = useCallback(async () => {
    console.log(`stopRecordingAndTranscribe called. Current state: ${state}`);

    if (state !== "recording") {
      console.warn(`stopRecordingAndTranscribe: State is '${state}', expected 'recording'. Aborting.`);
      return;
    }

    // Get current process ref before maybe clearing it
    const processToStop = soxProcessRef.current;

    if (processToStop) {
      console.log(`Attempting to stop recording process PID: ${processToStop.pid}...`);
      soxProcessRef.current = null; // Clear ref immediately
      console.log("Cleared sox process ref.");
      try {
         if (!processToStop.killed) {
             // Send SIGTERM first for graceful shutdown
             process.kill(processToStop.pid!, "SIGTERM");
             console.log(`Sent SIGTERM to PID ${processToStop.pid}`);
             // Give it time to die gracefully before transcription starts
          await new Promise((resolve) => setTimeout(resolve, 100));
         } else {
            console.log(`Process ${processToStop.pid} was already killed.`);
         }
      } catch (e) {
        // Handle potential errors (like process already exited - ESRCH)
        if (e instanceof Error && "code" in e && e.code !== "ESRCH") {
           console.warn(`Error stopping sox process PID ${processToStop.pid}:`, e);
        } else {
           console.log(`Process ${processToStop.pid} likely already exited.`);
        }
      }
    } else {
       console.warn("stopRecordingAndTranscribe: No active sox process reference found to stop.");
    }

    // Trigger transcription using hooks function
    await startTranscription();
  }, [state, startTranscription]); 

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

  const getActionPanel = useCallback(() => {
    switch (state) {
      case "recording":
        return (
          <ActionPanel>
            <Action title="Stop and Transcribe" icon={Icon.Stop} onAction={stopRecordingAndTranscribe} />
            <Action
              title="Cancel Recording"
              icon={Icon.XMarkCircle}
              shortcut={{ modifiers: ["cmd"], key: "." }}
              onAction={() => {
               const processToStop = soxProcessRef.current;
               if (processToStop && !processToStop.killed) {
                 try {
                   process.kill(processToStop.pid!, "SIGKILL"); // Immediate stop
                   console.log(`Cancel Recording: Sent SIGKILL to PID ${processToStop.pid}`);
                  } catch (e) {
                    /* Ignore ESRCH */
                  }
                 soxProcessRef.current = null;
               }
               cleanupAudioFile(); // Clean up partial file
               closeMainWindow({ clearRootSearch: true, popToRootType: PopToRootType.Immediate });
              }}
            />
            <Action
              title="Retry Recording"
              icon={Icon.ArrowClockwise}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
              onAction={() => {
                console.log("Retry Recording action triggered.");
                cleanupAudioFile(); 
                restartRecording(); 
              }}
            />
          </ActionPanel>
        );
      case "done":
        return (
          <ActionPanel>
            <Action.CopyToClipboard
              title={DEFAULT_ACTION === "copy" ? "Copy Text (Default)" : "Copy Text"}
              content={transcribedText}
              shortcut={{ modifiers: ["cmd"], key: "enter" }}
              onCopy={() =>
                closeMainWindow({ clearRootSearch: true, popToRootType: PopToRootType.Immediate })
              } // Close after copy
            />
            <Action.Paste
              title={DEFAULT_ACTION === "paste" ? "Paste Text (Default)" : "Paste Text"}
              content={transcribedText}
              shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
              onPaste={() =>
                closeMainWindow({ clearRootSearch: true, popToRootType: PopToRootType.Immediate })
              } // Close after paste
            />
            <Action
              title="View History"
              icon={Icon.List}
              shortcut={{ modifiers: ["cmd"], key: "h" }}
              onAction={async () => {
                await launchCommand({ name: "dictation-history", type: LaunchType.UserInitiated });
              }}
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
            <Action
              title="Open Extension Preferences"
              icon={Icon.Gear}
               onAction={() => {
                openExtensionPreferences();
                closeMainWindow({ clearRootSearch: true, popToRootType: PopToRootType.Immediate });
              }}
            />
            <Action
              title="Retry (Reopen Command)"
              icon={Icon.ArrowClockwise}
              onAction={() => {
                  showHUD("Please reopen the Dictate Text command.");
                  closeMainWindow({ clearRootSearch: true, popToRootType: PopToRootType.Immediate });
              }}
            />
            <Action
              title="Download Model"
              icon={Icon.Download}
              onAction={async () => {
                  await launchCommand({ name: "download-model", type: LaunchType.UserInitiated });
              }}
            />
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
  }, [state, stopRecordingAndTranscribe, transcribedText, cleanupAudioFile, DEFAULT_ACTION]); 

  if (state === "configuring") {
    // while checking config, show loading
    return <Detail isLoading={true} markdown={"Checking Whisper configuration..."} />;
  }

  if (state === "recording") {
    let refinementSection = "";
    
    if (isRefinementActive && currentRefinementPrompt) {
      const activePrompt = prompts.find(p => p.prompt === currentRefinementPrompt);
      const promptName = activePrompt?.name || "Unknown Prompt";
      refinementSection = `**AI Refinement: ${promptName}**\n\n`;
    }

    const waveformWithRefinement = refinementSection + generateWaveformMarkdown();
    
    return <Detail markdown={waveformWithRefinement} actions={getActionPanel()} />;
  }

  //Dictation UI
  return (
    <Form
      isLoading={state === "transcribing"}
      actions={getActionPanel()}
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
              {state === 'done' && aiErrorMessage && (
           <Form.Description
             title="AI Refinement Error"
             text={aiErrorMessage}
           />
       )}
    </Form>
  );
}
