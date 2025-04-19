import { useEffect, useRef, type MutableRefObject, type Dispatch, type SetStateAction, useCallback } from "react";
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

interface UseRecordingResult {
  restartRecording: () => void;
}

/**
 * Hook to manage audio recording for transcription with SoX.
 * @param config - Configuration object with paths to required executables and models
 * @param setState - Function to update the command state
 * @param setErrorMessage - Function to set error message when errors occur
 * @param soxProcessRef - Mutable ref to track the SoX child process
 */
export function useRecording(
  state: CommandState,
  config: Config | null,
  setState: Dispatch<SetStateAction<CommandState>>,
  setErrorMessage: Dispatch<SetStateAction<string>>,
  soxProcessRef: MutableRefObject<ChildProcessWithoutNullStreams | null>
): UseRecordingResult {
  // Track whether we've already started recording in this session
  const hasStartedRef = useRef(false);
  // Ref to hold latest state for event handlers (avoid stale closures and TS narrowing)
  const stateRef = useRef<CommandState>(state);
  // Update stateRef when state changes
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Function to restart recording via action
const restartRecording = useCallback(() => {
    console.log("useRecording: restartRecording called.");
    const currentProcess = soxProcessRef.current;
    if (currentProcess && !currentProcess.killed) {
      console.log(`useRecording: Killing existing process PID: ${currentProcess.pid} for restart.`);
      try {
        process.kill(currentProcess.pid!, "SIGKILL"); // Force kill for quick restart
        console.log(`useRecording: Sent SIGKILL to PID ${currentProcess.pid}`);
      } catch (e) {
         if (e instanceof Error && 'code' in e && e.code !== 'ESRCH') {
           console.warn(`useRecording: Error sending SIGKILL during restart:`, e);
         } else {
           console.log(`useRecording: Process ${currentProcess.pid} likely already exited during restart.`);
         }
      }
      soxProcessRef.current = null; // Clear ref
    } else {
       console.log("useRecording: No active process found to kill for restart.");
    }

    hasStartedRef.current = false; // Allow recording to start again
    setErrorMessage(""); 
    setState("idle"); 
    console.log("useRecording: Set state to idle to trigger restart.");

  }, [setState, setErrorMessage, soxProcessRef]);


  // Effect to start recording when state becomes idle
  useEffect(() => {
    // Only run effect when state is idle and hasn't started recording yet
    if (state !== "idle" || !config || hasStartedRef.current || soxProcessRef.current) {
      console.log(`useRecording effect skipped: state=${state}, config=${!!config}, hasStarted=${hasStartedRef.current}, processExists=${!!soxProcessRef.current}`);
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
            if (isMounted && stateRef.current === "recording" && signal !== 'SIGTERM' && code !== 0) {
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
  }, [config, state, setState, setErrorMessage, soxProcessRef]); 

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
  }, [soxProcessRef]); 
  return { restartRecording }; 
}