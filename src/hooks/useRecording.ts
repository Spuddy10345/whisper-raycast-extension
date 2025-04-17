import { useEffect, useRef, type MutableRefObject, type Dispatch, type SetStateAction } from "react";
import { showToast, Toast } from "@raycast/api";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import path from 'path';
import fs from 'fs';
import { environment } from "@raycast/api";

const AUDIO_FILE_PATH = path.join(environment.supportPath, "raycast_dictate_audio.wav");

type CommandState = "configuring" | "idle" | "recording" | "transcribing" | "done" | "error";
interface Config {
  execPath: string;
  modelPath: string;
  soxPath: string;
}

export function useRecording(
  state: CommandState,
  config: Config | null,
  setState: Dispatch<SetStateAction<CommandState>>,
  setErrorMessage: Dispatch<SetStateAction<string>>,
  soxProcessRef: MutableRefObject<ChildProcessWithoutNullStreams | null>
) {
  // Track whether we've already started recording in this session
  const hasStartedRef = useRef(false);

  // Effect to start recording when state becomes idle
  useEffect(() => {
    // Only run effect when state is idle and hasn't started recording yet
    if (state !== "idle" || !config || hasStartedRef.current || soxProcessRef.current) {
      return;
    }

    let isMounted = true;
    
    const startRecording = async () => {
      const audioDir = path.dirname(AUDIO_FILE_PATH);
      try {
        // Ensure directory exists
        await fs.promises.mkdir(audioDir, { recursive: true });
        if (!isMounted) return;

        console.log("useRecording: Configuration ready, attempting to start recording.");
        setState("recording");
        showToast({ style: Toast.Style.Animated, title: "Recording...", message: "Press Enter to stop" });

        const args = [
          "-d", // Default device
          "-t", "wav", // Output WAV
          "--channels", "1", // Mono
          "--rate", "16000", // Sample rate for whisper
          "--encoding", "signed-integer", // 16-bit PCM
          "--bits", "16",
          AUDIO_FILE_PATH,
        ];

        // Spawn the process
        const process = spawn(config.soxPath, args);
        soxProcessRef.current = process; // Update the shared ref
        hasStartedRef.current = true; // Mark recording as started

        console.log(`useRecording: Spawned sox process with PID: ${process.pid}`);

        process.on('error', (err) => {
          console.error(`useRecording: sox process PID ${process.pid} error event:`, err);
          if (soxProcessRef.current === process) {
            soxProcessRef.current = null;
          }
          if (isMounted) {
            setErrorMessage(`Recording failed: ${err.message}`);
            setState("error");
          }
        });

        process.stderr.on('data', (data) => {
          console.log(`useRecording: sox stderr PID ${process.pid}: ${data.toString()}`);
        });

        process.on('close', (code, signal) => {
          console.log(`useRecording: sox process PID ${process.pid} closed. Code: ${code}, Signal: ${signal}`);
          // Clear global ref only if still points to process that just closed
          if (soxProcessRef.current === process) {
            soxProcessRef.current = null;
            console.log("useRecording: Cleared sox process ref due to close event.");
            // If process closed while we were supposed to be recording, error out
            if (isMounted && state === "recording" && signal !== 'SIGTERM' && code !== 0) {
              console.warn(`useRecording: SoX process closed unexpectedly (code: ${code}, signal: ${signal}).`);
              setErrorMessage(`Recording process stopped unexpectedly.`);
              setState("error");
            }
          }
        });

      } catch (err: any) {
        console.error("useRecording: Error during recording setup/spawn:", err);
        if (isMounted) {
          setErrorMessage(`Failed to start recording: ${err.message}`);
          setState("error");
        }
      }
    };

    // Attempt to start recording
    startRecording();

    return () => {
      isMounted = false;
    };
  }, [config]); 

  // effect for component cleanup
  useEffect(() => {
    return () => {
      // only runs when component unmounts
      console.log(`useRecording cleanup on unmount: PID: ${soxProcessRef.current?.pid}`);
      
      if (soxProcessRef.current && !soxProcessRef.current.killed) {
        console.log(`useRecording cleanup: Component unmounting while process ${soxProcessRef.current.pid} is active. Killing process.`);
        try {
          process.kill(soxProcessRef.current.pid!, "SIGKILL");
          console.log(`useRecording cleanup: Sent SIGKILL to PID ${soxProcessRef.current.pid}`);
          soxProcessRef.current = null;
        } catch (e) {
          if (e instanceof Error && 'code' in e && e.code !== 'ESRCH') {
            console.warn(`useRecording cleanup: Error sending SIGKILL:`, e);
          }
        }
      }
    };
  }, []); 
}