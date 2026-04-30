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
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { useConfiguration } from "./hooks/useConfiguration";
import { useRecording } from "./hooks/useRecording";
import { useTranscription } from "./hooks/useTranscription";

interface TranscriptionHistoryItem {
  id: string;
  timestamp: number;
  text: string;
}

const AUDIO_FILE_PATH = path.join(environment.supportPath, "raycast_dictate_audio.wav");
const HISTORY_STORAGE_KEY = "dictationHistory";

type CommandState =
  | "configuring"
  | "configured_waiting_selection"
  | "selectingPrompt"
  | "idle"
  | "recording"
  | "transcribing"
  | "done"
  | "error";

interface Config {
  execPath: string;
  modelPath: string;
  soxPath: string;
}

export default function SimpleDictateCommand() {
  const [state, setState] = useState<CommandState>("configuring");
  const [transcribedText, setTranscribedText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const soxProcessRef = useRef<ChildProcessWithoutNullStreams | null>(null);
  const [waveformSeed, setWaveformSeed] = useState<number>(0);
  const [config, setConfig] = useState<Config | null>(null);

  const preferences = getPreferenceValues<Preferences>();
  const DEFAULT_ACTION = preferences.defaultAction || "none";

  const cleanupAudioFile = useCallback(() => {
    fs.promises
      .unlink(AUDIO_FILE_PATH)
      .then(() => console.log("Cleaned up audio file."))
      .catch((err) => {
        if (err.code !== "ENOENT") {
          console.error("Error cleaning up audio file:", err.message);
        }
      });
  }, []);

  useConfiguration(setState, setConfig, setErrorMessage);

  const saveTranscriptionToHistory = useCallback(async (text: string) => {
    if (!text || text === "[BLANK_AUDIO]") return;

    try {
      const newItem: TranscriptionHistoryItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        text: text,
      };

      let history: TranscriptionHistoryItem[] = [];
      const existingHistory = await LocalStorage.getItem<string>(HISTORY_STORAGE_KEY);
      if (existingHistory) {
        try {
          history = JSON.parse(existingHistory);
        } catch (parseError) {
          console.error("Failed to parse history from LocalStorage:", parseError);
          await showToast({
            style: Toast.Style.Failure,
            title: "Warning",
            message: "Could not read previous dictation history. Clearing history.",
          });
          history = [];
        }
      }

      history.unshift(newItem);

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

  const { startTranscription, handlePasteAndCopy } = useTranscription({
    config,
    preferences,
    setState,
    setErrorMessage,
    setTranscribedText,
    refineText: async (text: string) => text, // No AI refinement
    saveTranscriptionToHistory,
    cleanupAudioFile,
    aiErrorMessage: "",
    skipAIForSession: true, // Always skip AI for simple dictate
  });

  // Function to stop recording and transcribe
  const stopRecordingAndTranscribe = useCallback(async () => {
    console.log(`stopRecordingAndTranscribe called. Current state: ${state}`);

    if (state !== "recording") {
      console.warn(`stopRecordingAndTranscribe: State is '${state}', expected 'recording'. Aborting.`);
      return;
    }

    const processToStop = soxProcessRef.current;

    if (processToStop) {
      console.log(`Attempting to stop recording process PID: ${processToStop.pid}...`);
      soxProcessRef.current = null;
      console.log("Cleared sox process ref.");
      try {
        if (!processToStop.killed) {
          process.kill(processToStop.pid!, "SIGTERM");
          console.log(`Sent SIGTERM to PID ${processToStop.pid}`);
          await new Promise((resolve) => setTimeout(resolve, 100));
        } else {
          console.log(`Process ${processToStop.pid} was already killed.`);
        }
      } catch (e) {
        if (e instanceof Error && "code" in e && e.code !== "ESRCH") {
          console.warn(`Error stopping sox process PID ${processToStop.pid}:`, e);
        } else {
          console.log(`Process ${processToStop.pid} likely already exited.`);
        }
      }
    } else {
      console.warn("stopRecordingAndTranscribe: No active sox process reference found to stop.");
    }

    await startTranscription();
  }, [state, startTranscription]);

  const { restartRecording } = useRecording(state, config, setState, setErrorMessage, soxProcessRef);

  // Effect to automatically transition to idle after configuration (skip prompt selection)
  useEffect(() => {
    if (state === "configured_waiting_selection") {
      setState("idle");
    }
  }, [state]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (state === "recording") {
      intervalId = setInterval(() => {
        setWaveformSeed((prev) => prev + 1);
      }, 150);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [state]);

  useEffect(() => {
    if (state === "transcribing") {
      const timer = setTimeout(() => {
        startTranscription();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [state, startTranscription]);

  useEffect(() => {
    return () => {
      const currentProcess = soxProcessRef.current;
      if (currentProcess && !currentProcess.killed) {
        console.log(`Cleanup: Killing process PID: ${currentProcess.pid}`);
        try {
          process.kill(currentProcess.pid!, "SIGKILL");
        } catch (e) {
          if (e instanceof Error && "code" in e && e.code !== "ESRCH") {
            console.warn("Cleanup: Error sending SIGKILL:", e);
          }
        }
      }
      cleanupAudioFile();
    };
  }, [cleanupAudioFile]);

  const waveformWidth =
    preferences.waveformWidth === "custom"
      ? parseInt(preferences.waveformWidthCustom, 10) || 70
      : parseInt(preferences.waveformWidth, 10) || 70;

  // Precompute the static base-amplitude curve for each column. Depends only on
  // waveformWidth, so we only recompute it when the preference changes — not on
  // every animation frame.
  const baseAmplitudes = useMemo(() => {
    const arr = new Float32Array(waveformWidth);
    for (let x = 0; x < waveformWidth; x++) {
      const t = (x / waveformWidth) * Math.PI;
      arr[x] = Math.sin(t * 4) * 0.3 + Math.sin(t * 8) * 0.15 + Math.sin(t * 2) * 0.25;
    }
    return arr;
  }, [waveformWidth]);

  const generateWaveformMarkdown = useCallback(() => {
    const waveformHeight = 18;
    const header = waveformWidth >= 40 ? "RECORDING AUDIO... PRESS ENTER TO STOP" : "RECORDING (Enter to stop)";
    let waveform = "```\n" + header + "\n\n";

    // Compute the time-varying normalized amplitude per column once per frame,
    // then reuse it across all rows — distFromCenter is the only y-dependent term.
    const normalizedAmplitudes = new Float32Array(waveformWidth);
    for (let x = 0; x < waveformWidth; x++) {
      const randomFactor = Math.sin(x + waveformSeed * 0.3) * 0.2;
      normalizedAmplitudes[x] = (baseAmplitudes[x] + randomFactor + 0.7) * waveformHeight * 0.5;
    }

    for (let y = 0; y < waveformHeight; y++) {
      const distFromCenter = Math.abs(y - waveformHeight / 2);
      let line = "";
      for (let x = 0; x < waveformWidth; x++) {
        const norm = normalizedAmplitudes[x];
        if (distFromCenter < norm) {
          const intensity = 1 - distFromCenter / norm;
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
    waveform += "```";
    return waveform;
  }, [waveformSeed, waveformWidth, baseAmplitudes]);

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
                    process.kill(processToStop.pid!, "SIGKILL");
                    console.log(`Cancel Recording: Sent SIGKILL to PID ${processToStop.pid}`);
                  } catch {
                    /* Ignore ESRCH */
                  }
                  soxProcessRef.current = null;
                }
                cleanupAudioFile();
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
              onCopy={() => closeMainWindow({ clearRootSearch: true, popToRootType: PopToRootType.Immediate })}
            />
            <Action.Paste
              title={DEFAULT_ACTION === "paste" ? "Paste Text (Default)" : "Paste Text"}
              content={transcribedText}
              shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
              onPaste={() => closeMainWindow({ clearRootSearch: true, popToRootType: PopToRootType.Immediate })}
            />
            <Action
              title={DEFAULT_ACTION === "copy_paste" ? "Copy & Paste Text (Default)" : "Copy & Paste Text"}
              icon={Icon.Clipboard}
              shortcut={{ modifiers: ["cmd", "opt"], key: "enter" }}
              onAction={() => handlePasteAndCopy(transcribedText)}
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
        return null;
      case "error":
        return (
          <ActionPanel>
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
                showHUD("Please reopen the Simple Dictate command.");
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
      default:
        return (
          <ActionPanel>
            <Action title="Start Recording" icon={Icon.Microphone} onAction={() => setState("recording")} />
            <Action
              title="View History"
              icon={Icon.List}
              shortcut={{ modifiers: ["cmd"], key: "h" }}
              onAction={async () => {
                await launchCommand({ name: "dictation-history", type: LaunchType.UserInitiated });
              }}
            />
            <Action
              title="Open Extension Preferences"
              icon={Icon.Gear}
              onAction={() => {
                openExtensionPreferences();
                closeMainWindow({ clearRootSearch: true, popToRootType: PopToRootType.Immediate });
              }}
            />
            <Action title="Close" icon={Icon.XMarkCircle} onAction={closeMainWindow} />
          </ActionPanel>
        );
    }
  }, [
    state,
    stopRecordingAndTranscribe,
    transcribedText,
    cleanupAudioFile,
    DEFAULT_ACTION,
    handlePasteAndCopy,
    restartRecording,
  ]);

  if (state === "configuring") {
    return <Detail isLoading={true} markdown={"Checking Whisper configuration..."} />;
  }

  if (state === "recording") {
    const waveformMarkdown = generateWaveformMarkdown();
    return <Detail markdown={waveformMarkdown} actions={getActionPanel()} />;
  }

  return (
    <Form
      isLoading={state === "transcribing"}
      actions={getActionPanel()}
      navigationTitle={
        state === "transcribing"
          ? "Transcribing..."
          : state === "done"
            ? "Transcription Result"
            : state === "error"
              ? "Error"
              : "Simple Dictation"
      }
    >
      {state === "error" && <Form.Description title="Error" text={errorMessage} />}
      {(state === "done" || state === "transcribing" || state === "idle") && (
        <Form.TextArea
          id="dictatedText"
          title={state === "done" ? "Dictated Text" : ""}
          placeholder={
            state === "transcribing"
              ? "Transcribing audio..."
              : state === "done"
                ? "Transcription result"
                : "Press Enter to start recording..."
          }
          value={state === "done" ? transcribedText : ""}
          onChange={setTranscribedText}
        />
      )}
      {state === "transcribing" && <Form.Description text="Processing audio, please wait..." />}
      {state === "idle" && (
        <Form.Description text="Simple dictation without AI refinement. Press Enter to start recording." />
      )}
    </Form>
  );
}
