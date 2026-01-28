import { useState, useCallback } from 'react';

export function useTranscription() {
    const [isRecording, setIsRecording] = useState(false);
    const [transcribingField, setTranscribingField] = useState<string | null>(null);
    const [transcription, setTranscription] = useState('');
    const [error, setError] = useState<string | null>(null);

    const startTranscription = useCallback(async (field: string) => {
        setTranscribingField(field);
        setTranscription('');
        setError(null);
        setIsRecording(true);
        
        // Mock behavior
        console.log("Transcription started (Mock)");
    }, []);

    const stopTranscription = useCallback(async () => {
        setIsRecording(false);
        setTranscribingField(null);
        setError("La transcripción por IA está desactivada en esta versión.");
    }, []);

    return { isRecording, transcribingField, transcription, error, startTranscription, stopTranscription };
}