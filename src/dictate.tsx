import {
  ActionPanel,
  Form,
  Action,
  showToast,
  Toast,
  closeMainWindow,
  Icon,
  Detail,
} from "@raycast/api";
import { useState, useEffect, useRef, useCallback } from "react";
import { spawn, exec } from "child_process";
import type { ChildProcessWithoutNullStreams } from "child_process";

// Paths
const SOX_PATH = "/opt/homebrew/bin/sox";
const WHISPER_CPP_PATH = "/Users/finjo/Documents/Raycast/whisper.cpp/build/bin/whisper-cli";
const MODEL_PATH = "/Users/finjo/Documents/Raycast/whisper.cpp/models/ggml-base.en.bin";
const AUDIO_FILE_PATH = "/tmp/raycast_dictate_audio.wav"; 

// Define states
type CommandState = "idle" | "recording" | "transcribing" | "done" | "error";

export default function Command() {
  const [state, setState] = useState<CommandState>("idle");
  const [transcribedText, setTranscribedText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const soxProcessRef = useRef<ChildProcessWithoutNullStreams | null>(null);
  const [waveformSeed, setWaveformSeed] = useState<number>(0);


  // Stable cleanup function
  const cleanupSoxProcess = useCallback(() => {
    if (soxProcessRef.current) {
      console.log("Cleaning up sox process...");
      // Check if process is still running before killing
      if (!soxProcessRef.current.killed) {
          try {
             soxProcessRef.current.kill("SIGTERM"); // Send SIGTERM
          } catch (e) {
              console.warn("Error sending SIGTERM", e);
          }
      }
      soxProcessRef.current = null;
    }
     // Clean up audio file
    exec(`rm -f ${AUDIO_FILE_PATH}`, (err) => {
        if (err) console.error("Error cleaning up audio file:", err.message);
        else console.log("Cleaned up audio file.");
    });
  }, []);


  // Start recording on mount
  useEffect(() => {
    // should only run once on mount
    console.log("useEffect mount: Setting state to recording.");
    setState("recording");
    showToast({ style: Toast.Style.Animated, title: "Recording...", message: "Press Enter to stop" });

    const args = ["-d", "-t", "wav", AUDIO_FILE_PATH];
    let process: ChildProcessWithoutNullStreams | null = null;
    try {
        process = spawn(SOX_PATH, args);
        soxProcessRef.current = process;
        console.log("Spawned sox process.");
    } catch (err: any) {
        console.error("sox spawn synchronous error:", err);
        setErrorMessage(`Failed to start recording command. Error: ${err.message}`);
        setState("error");
        return; // Don't attach listeners if failed to start
    }


    process.on('error', (err) => {
      console.error("sox process error event:", err);
      setErrorMessage(`Recording process failed. Error: ${err.message}`);
      setState("error");
      soxProcessRef.current = null;
    });

    process.stderr.on('data', (data) => {
      const output = data.toString();
      console.log(`sox stderr: ${data}`);
    });


    process.on('close', (code, signal) => {
      console.log(`sox process closed. Code: ${code}, Signal: ${signal}`);
      // Ensure ref is nullified if the process closes itself
      if (soxProcessRef.current === process) {
          soxProcessRef.current = null;
          console.log("Cleared sox process ref due to close event.");
      }
    });

    // Cleanup function on component unmount
    return () => {
      console.log("useEffect cleanup: Component unmounting or dependency changed.");
      cleanupSoxProcess();
    };
  }, []); // Use empty dependency array to ensure it runs only once on mount


  const stopRecordingAndTranscribe = async () => {
    // Read 'state' directly from the current render's scope
    console.log(`stopRecordingAndTranscribe called. Current state from scope: ${state}`);

    if (state !== "recording") {
       console.warn(`stopRecordingAndTranscribe: State is '${state}', expected 'recording'. Aborting stop sequence.`);
       return;
    }

    const processToStop = soxProcessRef.current; // Capture ref value 

    if (!processToStop) {
        console.error("stopRecordingAndTranscribe: No process reference found, though state was 'recording'.");
        setErrorMessage("Could not stop recording process. Reference lost.");
        setState("error");
        return;
    }

    // Set state 
    setState("transcribing");
    showToast({ style: Toast.Style.Animated, title: "Transcribing..." });
    console.log("Stopping recording...");

    soxProcessRef.current = null;
    console.log("Cleared sox process ref before killing.");


    // Send SIGTERM first 
    console.log("Sending SIGTERM to process...");
    processToStop.kill("SIGTERM");


    // Wait for the process to close or timeout
    const closePromise = new Promise<void>(resolve => {
       const timeout = setTimeout(() => {
          console.warn("Timeout waiting for sox process close after SIGTERM.");
          resolve();
       }, 1000); // Wait 1 second max

       processToStop.on('close', (code, signal) => {
          clearTimeout(timeout);
          console.log(`sox process confirmed closed during stop. Code: ${code}, Signal: ${signal}`);
          resolve();
       });

       processToStop.on('error', (err) => { // Handle errors during shutdown too
          clearTimeout(timeout);
          console.error("Error during sox process shutdown:", err);
          resolve(); // Resolve anyway to allow transcription attempt
       });
    });

    await closePromise;


    // Check if it's still somehow alive 
    if (!processToStop.killed) {
       console.log("SoX process still alive after SIGTERM and wait, sending SIGKILL.");
       try {
           processToStop.kill("SIGKILL"); // Force kill if needed
       } catch (e) {
           console.warn("Error sending SIGKILL (process might be already dead):", e);
       }
    }


    console.log("Starting transcription...");
    exec(
      `${WHISPER_CPP_PATH} -m ${MODEL_PATH} -f ${AUDIO_FILE_PATH} -l en -otxt`,
      (error, stdout, stderr) => {
        if (error) {
          console.error("whisper error:", error);
          console.error("whisper stderr:", stderr);
          setErrorMessage(`Transcription failed: ${stderr || error.message}`);
          setState("error");
        } else {
          console.log("Transcription successful.");
          // Removes [00:00:00.000 --> 00:00:05.000]  and [pause]
          console.log("Raw whisper stdout:", stdout);

          // Remove all content within square brackets using regex
          let cleanedText = stdout.replace(/\[.*?\]/g, '');

          // Remove multiple whitespace 
          cleanedText = cleanedText.replace(/\s+/g, ' ');

          // remove leading/trailing whitespace
          cleanedText = cleanedText.trim();

          console.log("Cleaned text:", cleanedText); // Log the final cleaned text
          setTranscribedText(cleanedText);
          setState("done");
          showToast({ style: Toast.Style.Success, title: "Transcription complete" });
        }
        // Clean up audio file whether transcription success/failure
        exec(`rm -f ${AUDIO_FILE_PATH}`, (err) => {
             if (err) console.error("Error cleaning up audio file post-transcription:", err.message);
             else console.log("Cleaned up audio file post-transcription.");
         });
      }
    );
  }; 

// Animate waveform
useEffect(() => {
  if (state === "recording") {
    const intervalId = setInterval(() => {
      setWaveformSeed(prev => prev + 1);
    }, 150);
    
    return () => clearInterval(intervalId);
  }
}, [state]);

// Generate the waveform 
const generateWaveformMarkdown = useCallback(() => {
  //control waveform height/width
  const waveformHeight = 18;
  const waveformWidth = 105;
  
  // Create a sine wave pattern with randomness
  let waveform = "";
  
  // Add a small header in the waveform area
  waveform += "RECORDING AUDIO... PRESS ENTER TO STOP\n\n";
  
  // Generate waveform pattern
  for (let y = 0; y < waveformHeight; y++) {
    let line = "";
    for (let x = 0; x < waveformWidth; x++) {
      const baseAmplitude1 = Math.sin((x / waveformWidth) * Math.PI * 4) * 0.3;
      const baseAmplitude2 = Math.sin((x / waveformWidth) * Math.PI * 8) * 0.15;
      const baseAmplitude3 = Math.sin((x / waveformWidth) * Math.PI * 2) * 0.25;
      const baseAmplitude = baseAmplitude1 + baseAmplitude2 + baseAmplitude3;
      
      // Add randomness that changes with each go around
      const randomFactor = Math.sin(x + waveformSeed * 0.3) * 0.2;
      const amplitude = baseAmplitude + randomFactor;
      
      // Normalize to waveform height
      const normalizedAmplitude = (amplitude + 0.7) * waveformHeight * 0.5;
      
      // Determine character to display
      const distFromCenter = Math.abs(y - waveformHeight/2);
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
  
  return `\`\`\`\n${waveform}\`\`\``;
}, [waveformSeed]);

  const getActionPanel = () => {
    console.log(`getActionPanel called. Current state: ${state}`); 
    switch (state) {
      case "recording":
        return (
          <ActionPanel>
             {/* Wrap onAction to ensure latest callback reference is used */}
            <Action title="Stop Recording" icon={Icon.Stop} onAction={() => stopRecordingAndTranscribe()} />
            <Action title="Cancel Recording" icon={Icon.XMarkCircle} shortcut={{ modifiers: ["cmd"], key: "." }} onAction={() => {
               cleanupSoxProcess();
               closeMainWindow();
            }}/>
          </ActionPanel>
        );
      case "done":
        return (
          <ActionPanel>
            {/* Pass the stable cleanup function directly */}
            <Action.Paste title="Paste Text" content={transcribedText} onPaste={cleanupSoxProcess}/>
            <Action.CopyToClipboard title="Copy Text" content={transcribedText} shortcut={{ modifiers: ["cmd"], key: "enter" }} onCopy={cleanupSoxProcess}/>
             <Action title="Start New Dictation" icon={Icon.ArrowClockwise} onAction={() => {
                // Reset for a new recording
                setTranscribedText("");
                setErrorMessage("");
                 showToast({ title: "Ready for new dictation", message: "Close and reopen command" });
             }} />
          </ActionPanel>
        );
        case "transcribing":
        return (
          <ActionPanel>
             <Action title="Cancel Transcription" icon={Icon.XMarkCircle} shortcut={{ modifiers: ["cmd"], key: "." }} onAction={() => {
               cleanupSoxProcess(); // Clean up audio file 
               closeMainWindow();
            }}/>
          </ActionPanel>
        );
       case "error":
         return (
           <ActionPanel>
               <Action title="Start New Dictation" icon={Icon.ArrowClockwise} onAction={() => {
                  setErrorMessage(""); // Clear error

                  closeMainWindow();
                  showToast({ title: "Please reopen command", style: Toast.Style.Failure });
               }} />
              <Action title="Close" icon={Icon.XMarkCircle} onAction={closeMainWindow} />
           </ActionPanel>
         );
      default: 
        return (
           <ActionPanel>
              <Action title="Close" icon={Icon.XMarkCircle} onAction={closeMainWindow} />
           </ActionPanel>
        );
    }
  };

   const getPlaceholder = () => {
     switch (state) {
      case "recording": return "Recording... Press Enter to stop.";
      case "transcribing": return "Transcribing audio...";
      case "done": return "Transcribed Text...";
      case "error": return `Error: ${errorMessage}`;
      default: return "Initializing...";
     }
  }

  return (
    <>
      {state === "recording" && (
        <Detail
          markdown={generateWaveformMarkdown()}
          actions={getActionPanel()}
        />
      )}
      
      {state !== "recording" && (
        <Form
          isLoading={state === "transcribing"}
          actions={getActionPanel()}
        >
          <Form.TextArea
            id="dictatedText"
            title="Dictated Text"
            placeholder={getPlaceholder()}
            value={state === 'done' ? transcribedText : (state === 'error' ? errorMessage : "")}
            onChange={setTranscribedText}
          />
          {state === 'error' && <Form.Description text={`${errorMessage}`} />}
        </Form>
      )}
    </>
  );

}
