import { Platform } from "react-native";
import { useEffect } from "react";

let NativeModule: any = null;
let useNativeSpeechEvent: any = null;
let isNativeSupported = false;

try {
  // Try to dynamically require expo-speech-recognition to prevent crash in Expo Go
  const SpeechRecognition = require("expo-speech-recognition");
  if (SpeechRecognition && SpeechRecognition.ExpoSpeechRecognitionModule) {
    NativeModule = SpeechRecognition.ExpoSpeechRecognitionModule;
    useNativeSpeechEvent = SpeechRecognition.useSpeechRecognitionEvent;
    isNativeSupported = true;
  }
} catch (e) {
  console.log("expo-speech-recognition native module is not available (running in Expo Go)");
}

if (!useNativeSpeechEvent) {
  useNativeSpeechEvent = (event: string, callback: any) => {
    useEffect(() => {
      // Noop fallback in Expo Go
    }, [event, callback]);
  };
}

export const ExpoSpeechRecognitionModule = NativeModule;
export const useSpeechRecognitionEvent = useNativeSpeechEvent;
export const isSpeechRecognitionSupported = isNativeSupported;
