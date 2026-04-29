import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { getGhostbusterResponse } from "../lib/ghostbusterResponses";

const intros = [
  "Paranormal Hotline. This is dispatch. Okay, tell me what is happening.",
  "Ghost watch is online. Take a breath, tiny investigators. What do you hear?",
  "Spooky-response desk. We have the meters warmed up. Go ahead with your report.",
];

const prompts = [
  ["I hear it", "I hear something."],
  ["Trap it", "How do we trap it?"],
  ["It got away", "It got away."],
  ["We caught it", "We caught it."],
];

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function scoreVoice(voice) {
  let score = 0;
  if (/premium|enhanced|neural|natural|samantha|alex|daniel|jamie|google|microsoft/i.test(voice.name)) score += 5;
  if (/us|gb|au/i.test(voice.lang)) score += 2;
  if (voice.localService) score += 1;
  return score;
}

export default function GhostbusterHotline() {
  const [status, setStatus] = useState("Ready to call");
  const [caption, setCaption] = useState("Tap call, then tell the crew what you hear.");
  const [connected, setConnected] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoListen, setAutoListen] = useState(true);
  const [voices, setVoices] = useState([]);
  const [voiceChoice, setVoiceChoice] = useState("auto");
  const recognitionRef = useRef(null);
  const respondingRef = useRef(false);

  function selectedVoice() {
    if (voiceChoice === "auto") return voices[0] || null;
    return voices[Number(voiceChoice)] || voices[0] || null;
  }

  function speak(text, onDone) {
    if (typeof window === "undefined") return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88;
    utterance.pitch = 0.92;
    utterance.volume = 1;

    const voice = selectedVoice();
    if (voice) utterance.voice = voice;

    const finish = () => {
      respondingRef.current = false;
      if (typeof onDone === "function") onDone();
    };

    utterance.addEventListener("end", finish);
    utterance.addEventListener("error", finish);
    window.speechSynthesis.speak(utterance);
  }

  function startListening() {
    if (typeof window === "undefined" || !recognitionRef.current) {
      setStatus("Tap a prompt");
      setCaption("This browser cannot listen through the microphone, so use the quick prompts.");
      return;
    }

    if (window.speechSynthesis.speaking) return;

    try {
      setListening(true);
      setStatus("Listening");
      setCaption("Tell the hotline what the ghost is doing.");
      recognitionRef.current.start();
    } catch {
      setListening(false);
    }
  }

  function stopListening() {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setListening(false);
  }

  function connectCall(announce = true) {
    setConnected(true);
    setStatus("Connected");

    if (announce) {
      speak(pick(intros), () => {
        if (autoListen) startListening();
      });
    } else {
      window.setTimeout(startListening, 250);
    }
  }

  function answer(input) {
    respondingRef.current = true;
    stopListening();

    let reply = "Say that again. My scanner spiked.";
    try {
      reply = getGhostbusterResponse(input);
    } catch (error) {
      console.error("Ghostbuster response error", error);
    }

    setStatus("Hotline says");
    setCaption(reply);
    speak(reply, () => {
      setStatus("Connected");
      if (autoListen) startListening();
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
        .sort((a, b) => scoreVoice(b) - scoreVoice(a));
      setVoices(availableVoices);
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    setVoiceChoice(window.localStorage.getItem("hotlineVoice") || "auto");

    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return undefined;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.addEventListener("result", (event) => {
      const transcript = event.results[0][0].transcript;
      setCaption(`"${transcript}"`);
      answer(transcript);
    });

    recognition.addEventListener("end", () => {
      setListening(false);
      if (connected && !respondingRef.current && !window.speechSynthesis.speaking && autoListen) {
        window.setTimeout(startListening, 800);
      }
    });

    recognition.addEventListener("error", () => {
      setListening(false);
      setStatus("Use quick prompts");
      setCaption("The microphone did not connect, but the hotline still works with the buttons.");
    });

    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, [autoListen, connected]);

  function handleCall() {
    if (!connected) {
      connectCall();
      return;
    }

    if (listening) {
      stopListening();
      return;
    }

    startListening();
  }

  function handleVoiceChange(event) {
    setVoiceChoice(event.target.value);
    window.localStorage.setItem("hotlineVoice", event.target.value);
  }

  return (
    <>
      <Head>
        <title>Paranormal Hotline</title>
        <meta name="robots" content="noindex,nofollow,noarchive" />
        <meta name="theme-color" content="#101114" />
      </Head>
      <main className="hotlineApp" aria-label="Paranormal response hotline">
        <section className="phone" aria-live="polite">
          <p className="eyebrow">Paranormal Hotline</p>
          <h1>{status}</h1>
          <p className="caption">{caption}</p>

          <button className={`callButton ${listening ? "listening" : ""} ${connected && !listening ? "connected" : ""}`} type="button" onClick={handleCall}>
            {!connected ? "Call" : listening ? "Listening" : "Talk"}
          </button>

          <div className="controls" aria-label="Quick prompts">
            {prompts.map(([label, prompt]) => (
              <button key={label} type="button" onClick={() => {
                if (!connected) connectCall(false);
                setCaption(prompt);
                answer(prompt);
              }}>
                {label}
              </button>
            ))}
          </div>

          <label className="toggle">
            <input type="checkbox" checked={autoListen} onChange={(event) => setAutoListen(event.target.checked)} />
            <span>Listen after each answer</span>
          </label>

          <label className="voiceControl">
            <span>Voice</span>
            <select value={voiceChoice} onChange={handleVoiceChange} aria-label="Voice">
              <option value="auto">Best available</option>
              {voices.map((voice, index) => (
                <option key={`${voice.name}-${voice.lang}`} value={index}>{voice.name} ({voice.lang})</option>
              ))}
            </select>
          </label>
        </section>
      </main>

      <style jsx global>{`
        body {
          min-height: 100vh;
          margin: 0;
          background: radial-gradient(circle at top left, rgba(36, 158, 112, 0.35), transparent 34rem), linear-gradient(145deg, #101114 0%, #242a32 54%, #141618 100%);
        }
      `}</style>

      <style jsx>{`
        .hotlineApp {
          width: min(100%, 34rem);
          min-height: 100vh;
          margin: 0 auto;
          padding: 1rem;
          color: #f6f1df;
          font-family: Arial, Helvetica, sans-serif;
        }

        .phone {
          min-height: min(42rem, calc(100vh - 2rem));
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 1rem;
          padding: 1.25rem;
          text-align: center;
        }

        .eyebrow {
          margin: 0;
          color: #84e0b0;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          font-size: clamp(2rem, 10vw, 4.5rem);
          line-height: 1;
        }

        .caption {
          min-height: 3.4rem;
          margin: 0 auto;
          max-width: 27rem;
          color: #d7d2c3;
          font-size: 1.2rem;
          line-height: 1.4;
        }

        button, select {
          font: inherit;
        }

        button {
          border: 0;
          color: inherit;
          cursor: pointer;
        }

        .callButton {
          width: min(68vw, 13rem);
          aspect-ratio: 1;
          margin: 1rem auto;
          border-radius: 50%;
          background: #1fb46a;
          color: #07130c;
          font-size: clamp(1.35rem, 7vw, 2.3rem);
          font-weight: 800;
          box-shadow: 0 1rem 3rem rgba(31, 180, 106, 0.32);
        }

        .callButton.listening {
          background: #f4c84f;
          box-shadow: 0 1rem 3rem rgba(244, 200, 79, 0.3);
        }

        .callButton.connected {
          background: #e85a4f;
          box-shadow: 0 1rem 3rem rgba(232, 90, 79, 0.28);
        }

        .controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.7rem;
        }

        .controls button {
          min-height: 3.25rem;
          border-radius: 0.5rem;
          padding: 0.7rem;
          background: rgba(255, 255, 255, 0.11);
          color: #f6f1df;
          font-weight: 700;
        }

        .toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          color: #d7d2c3;
          font-size: 0.95rem;
        }

        .toggle input {
          width: 1.2rem;
          height: 1.2rem;
          accent-color: #1fb46a;
        }

        .voiceControl {
          display: grid;
          gap: 0.4rem;
          color: #d7d2c3;
          font-size: 0.9rem;
          text-align: left;
        }

        .voiceControl select {
          width: 100%;
          min-height: 2.75rem;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 0.5rem;
          padding: 0 0.7rem;
          background: rgba(0, 0, 0, 0.28);
          color: #f6f1df;
        }

        @media (max-width: 26rem) {
          .controls {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
