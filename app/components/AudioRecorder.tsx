'use client';

import { useCallback, useEffect, useState, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';

const LiveTranscription = dynamic(
  () => import('./LiveTranscription'),
  { ssr: false }
);

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, transcript: string) => void;
  isProcessing: boolean;
}

interface CustomMediaRecorder {
  processor: ScriptProcessorNode;
  chunks: Float32Array[];
  state: 'recording' | 'inactive';
  stop: () => void;
}

const loadingMessages = [
  "Channeling Doctor Strange's medical expertise... Hold on, this might require some magic. 🪄",
  "Barbie says: 'I'm not just a fashion icon—I'm also a doctor!' 👩‍⚕️",
  "Taylor Swift is working on a new song: 'Patient History (10-Minute Version).' 🎵",
  "Consulting with House, M.D.—but without the sarcasm. 🏥",
  "Asking Wednesday Addams to brighten up this diagnosis… okay, maybe just a little. 🖤",
  "Transforming your words into SOAP notes—Optimus Prime style. 🤖",
  "Spider-Man's spidey sense is tingling… must be a breakthrough! 🕷️",
  "Welcome to The Last of Us: Medical Documentation Edition—don't worry, this infection is just a typo. 🌿",
  "Bluey's dad is helping write this note… turns out he's surprisingly good at it! 🐕",
  "Ted Lasso is giving your medical records the pep talk they deserve. 📋",
  "Baby Yoda is using the Force to organize these notes… but mostly just staring adorably. 👶",
  "Roman Roy from Succession is attempting medical terminology… this could get interesting. 💼",
  "Welcome to The Bear: Medical Scribe Kitchen Edition—yes, chef! 👨‍🍳",
  "Ahsoka's lightsaber is making precise edits to your notes. ⚔️",
  "Guardians of the Galaxy are on a mission… to ensure accurate documentation. 🚀",
  "Mario and Luigi: Medical Scribe Bros—let's-a go! 🍄",
  "Oppenheimer is calculating the most optimal treatment plan… with extreme precision. 💥",
  "Beyoncé's Renaissance Tour is now a Medical Documentation World Tour! 🎤",
  "Ken is trying his best at medical scribing… he's just Ken. 👱‍♂️",
  "The Super Mario Bros. Movie presents: Journey to Perfect Notes! 🎮",
  "Welcome to Avatar: The Way of Medical Documentation. 💧",
  "Top Gun: Maverick's guide to swift and accurate scribing—because speed matters. ✈️",
  "John Wick: Chapter 4… of your medical history. 🕴️",
  "Everything Everywhere All At Once… but make it medical notes. 🥢",
  "Following the Mandalorian's Code of Medical Documentation—this is the way. 🪖",
  "Loki is causing mischief in the medical records… let's rein that in. 😈",
  "Stranger Things are happening in these notes… better double-check. 🔮",
  "The Last Airbender is mastering the four elements… of SOAP notes. 🌪️",
  "Squid Game: Red Light, Green Light… but for medical documentation. 🦑",
  "WandaVision's sitcom-style medical documentation—expect some plot twists. 📺",
  "Bridgerton's Lady Whistledown is reviewing your medical history… and it's quite the scandal. 📜",
  "Welcome to The White Lotus: Medical Scribe Resort Edition! 🌺",
  "Cousin Greg from Succession is attempting medical terminology… bless his heart. 📱",
  "Abbott Elementary's guide to keeping notes organized and stress-free. 📚",
  "The Bear… but for medical notes. Brace yourself. 🔪",
  "Only Murders in the Building—except we're solving medical mysteries instead. 🔍",
  "Rick and Morty's interdimensional medical adventures… hold on, this might get weird. 🧪",
  "The Crown's royal approach to medical documentation—strictly by the book. 👑",
  "Heartstopper's gentle, well-organized medical notes—because details matter. 🍂",
  "Shadow and Bone's magical approach to scribing… precision is key. ⚡",
  "Toss a coin to your medical scribe—The Witcher is on the case! 🎵",
  "Emily in Paris… but she's learning French medical terms. 🗼",
  "Peaky Blinders' Tommy Shelby organizing patient files—by order of the medical board. 🎩",
  "The Good Place's Janet computing medical data—this note is not a robot. 🤖",
  "Brooklyn Nine-Nine's Jake Peralta is investigating symptoms—cool, cool, cool. 🚔",
  "Moira Rose from Schitt's Creek is pronouncing medical terms… dramatically. 🌹",
  "Michael Scott from The Office attempting medical documentation… what could go wrong? 📎",
  "Leslie Knope from Parks and Recreation ensuring patient care is organized to perfection. 📋",
  "The Community study group tackling medical terminology—self-taught, of course. 📖",
  "Walter White from Breaking Bad is calculating medication dosages… let's double-check that. ⚗️"
];

export default function AudioRecorder({ onRecordingComplete, isProcessing }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [usedMessageIndices, setUsedMessageIndices] = useState<Set<number>>(new Set());
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('');
  
  // Use refs for audio context and stream to prevent re-renders
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<CustomMediaRecorder | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);

  // Get a random unused loading message
  const getRandomLoadingMessage = useCallback(() => {
    const unusedIndices = Array.from(Array(loadingMessages.length).keys())
      .filter(i => !usedMessageIndices.has(i));
    
    if (unusedIndices.length === 0) {
      // Reset if all messages have been used
      setUsedMessageIndices(new Set());
      const randomIndex = Math.floor(Math.random() * loadingMessages.length);
      setUsedMessageIndices(new Set([randomIndex]));
      return loadingMessages[randomIndex];
    }
    
    const randomIndex = unusedIndices[Math.floor(Math.random() * unusedIndices.length)];
    setUsedMessageIndices(prev => new Set([...Array.from(prev), randomIndex]));
    return loadingMessages[randomIndex];
  }, [usedMessageIndices]);

  // Update loading message every 3 seconds
  useEffect(() => {
    if (isProcessing) {
      setCurrentLoadingMessage(getRandomLoadingMessage());
      const interval = setInterval(() => {
        setCurrentLoadingMessage(getRandomLoadingMessage());
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isProcessing, getRandomLoadingMessage]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    chunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      // Clean up any existing recording
      cleanup();

      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Create audio context
      const context = new AudioContext();
      audioContextRef.current = context;

      // Set up audio processing
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      chunksRef.current = [];

      // Handle audio processing more efficiently
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Only store every other chunk to reduce memory usage
        if (chunksRef.current.length % 2 === 0) {
          const chunk = new Float32Array(inputData.length);
          chunk.set(inputData);
          chunksRef.current.push(chunk);
        }
      };

      source.connect(processor);
      processor.connect(context.destination);

      const customMediaRecorder: CustomMediaRecorder = {
        processor,
        chunks: chunksRef.current,
        state: 'recording',
        stop: () => {
          processor.disconnect();
          source.disconnect();
          stream.getTracks().forEach(track => track.stop());
          customMediaRecorder.state = 'inactive';
        }
      };

      mediaRecorderRef.current = customMediaRecorder;
      setIsRecording(true);
      setTranscript('');
      setFinalTranscript('');
    } catch (error) {
      console.error('Error starting recording:', error);
      cleanup();
    }
  }, [cleanup]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Use the final transcript that's been accumulated
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
      const transcriptToUse = finalTranscript || transcript;
      
      if (transcriptToUse.trim()) {
        onRecordingComplete(audioBlob, transcriptToUse);
      } else {
        console.error('No transcript available');
      }
      
      // Reset for next recording
      cleanup();
      setTranscript('');
      setFinalTranscript('');
    }
  }, [transcript, finalTranscript, onRecordingComplete, cleanup]);

  const handleTranscriptUpdate = useCallback((newTranscript: string, isFinal: boolean) => {
    if (isFinal) {
      setFinalTranscript(prev => {
        const updatedTranscript = prev ? `${prev} ${newTranscript}` : newTranscript;
        return updatedTranscript.trim();
      });
    }
    setTranscript(newTranscript);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative flex justify-center items-center">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`
            relative w-20 h-20 rounded-full transition-all duration-300 ease-in-out
            flex items-center justify-center
            ${isRecording 
              ? 'bg-red-500 hover:bg-red-600 scale-110' 
              : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-lg hover:shadow-xl
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'transform hover:-translate-y-1'}
          `}
          aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          {/* Microphone icon */}
          <svg 
            className={`w-10 h-10 text-white transition-transform duration-200 ${isRecording ? 'scale-90' : 'scale-100'}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d={isRecording 
                ? "M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" 
                : "M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
              }
            />
          </svg>
          {/* Recording indicator ring */}
          {isRecording && (
            <svg
              className="absolute w-full h-full text-white opacity-20"
              viewBox="0 0 100 100"
              fill="none"
              stroke="currentColor"
            >
              <circle
                cx="50"
                cy="50"
                r="45"
                strokeWidth="3"
                className="animate-[spin_3s_linear_infinite]"
                strokeDasharray="70,30"
              />
            </svg>
          )}
        </button>
        
        {/* Status text */}
        <span className={`
          absolute -bottom-8 text-sm font-medium tracking-wide
          transition-all duration-300
          ${isRecording 
            ? 'text-red-500 dark:text-red-400' 
            : 'text-gray-400 dark:text-gray-500'
          }
        `}>
          {isRecording ? 'Recording...' : 'Ready'}
        </span>
      </div>

      {isProcessing && (
        <div className="text-center py-4 w-full max-w-md">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400 animate-fade-in transition-opacity duration-500">
            {currentLoadingMessage}
          </p>
        </div>
      )}

      <div className={`
        w-full max-w-2xl transition-all duration-300 ease-in-out
        ${isRecording ? 'opacity-100 translate-y-0' : 'opacity-80 translate-y-2'}
      `}>
        <Suspense fallback={
          <div className="bg-gray-50 dark:bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl h-[200px] relative overflow-hidden">
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse flex space-x-4">
                <div className="h-3 w-3 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                <div className="h-3 w-3 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                <div className="h-3 w-3 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              </div>
            </div>
          </div>
        }>
          <LiveTranscription 
            isRecording={isRecording} 
            onTranscriptUpdate={handleTranscriptUpdate}
          />
        </Suspense>
      </div>
    </div>
  );
}

// Helper function to create WAV buffer
function createWavBuffer(audioData: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + audioData.length * 2);
  const view = new DataView(buffer);

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + audioData.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, audioData.length * 2, true);

  // Write audio data
  const volume = 0.5;
  let index = 44;
  for (let i = 0; i < audioData.length; i++) {
    view.setInt16(index, audioData[i] * 0x7FFF * volume, true);
    index += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
} 