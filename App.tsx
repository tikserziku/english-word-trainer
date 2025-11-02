import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Word, LearningPhase } from './types';
import { WORDS_DATA } from './constants';
import { getExampleSentence } from './services/geminiService';
import { CheckCircleIcon, LightBulbIcon, MicrophoneIcon, VolumeUpIcon, XCircleIcon } from './components/IconComponents';

// --- Helper Components defined outside App to prevent re-creation on render ---

const ProgressBar: React.FC<{ current: number, total: number }> = ({ current, total }) => {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    return (
        <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
                className="bg-purple-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${percentage}%` }}
            ></div>
        </div>
    );
};

const WordCard: React.FC<{ word: Word, onSpeak: () => void }> = ({ word, onSpeak }) => (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-lg text-center transform transition-all duration-300">
        <h2 className="text-4xl font-bold text-purple-400">{word.word}</h2>
        <p className="text-xl text-gray-400 mt-1">{word.pronunciation}</p>
        <button
            onClick={onSpeak}
            className="mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-full text-white font-semibold transition-all transform hover:scale-105 flex items-center gap-2 mx-auto"
            aria-label="Listen to pronunciation"
        >
            <VolumeUpIcon className="w-6 h-6" />
            <span>Listen</span>
        </button>
        <div className="mt-6 text-left space-y-2">
            <p><strong className="text-purple-300">Translation (LT):</strong> {word.translation}</p>
            <p><strong className="text-purple-300">Explanation (EN):</strong> {word.explanation}</p>
        </div>
    </div>
);


// --- Main App Component ---

export default function App() {
    const [words, setWords] = useState<Word[]>([]);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [phase, setPhase] = useState<LearningPhase>('welcome');
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [hint, setHint] = useState('');
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [micCheckStatus, setMicCheckStatus] = useState<'idle' | 'listening' | 'success' | 'error'>('idle');
    const [micError, setMicError] = useState<string | null>(null);

    const recognitionRef = useRef<any | null>(null);
    const phaseRef = useRef(phase);
    useEffect(() => { phaseRef.current = phase }, [phase]);
    const currentWordRef = useRef(words[currentWordIndex]);
    useEffect(() => { currentWordRef.current = words[currentWordIndex] }, [words, currentWordIndex]);


    const speak = useCallback((text: string, lang = 'en-US') => {
        // Cancel any ongoing speech
        speechSynthesis.cancel();

        // Small delay for mobile devices
        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;
            utterance.rate = 0.9; // Slightly slower for clarity
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // Handle errors on mobile
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
            };

            speechSynthesis.speak(utterance);
        }, 100);
    }, []);
    
    useEffect(() => {
        setWords([...WORDS_DATA].sort(() => Math.random() - 0.5));

        // Initialize speech synthesis for mobile devices
        // This helps with autoplay restrictions on mobile browsers
        const initSpeech = () => {
            if ('speechSynthesis' in window) {
                // Trigger speech synthesis to "unlock" it on mobile
                const utterance = new SpeechSynthesisUtterance('');
                speechSynthesis.speak(utterance);
                speechSynthesis.cancel();
            }
        };

        // Call on first user interaction
        const handleFirstInteraction = () => {
            initSpeech();
            document.removeEventListener('click', handleFirstInteraction);
            document.removeEventListener('touchstart', handleFirstInteraction);
        };

        document.addEventListener('click', handleFirstInteraction);
        document.addEventListener('touchstart', handleFirstInteraction);

        return () => {
            document.removeEventListener('click', handleFirstInteraction);
            document.removeEventListener('touchstart', handleFirstInteraction);
        };
    }, []);

    const currentWord = words[currentWordIndex];

    const resetForNextWord = useCallback(() => {
        setFeedback(null);
        setInputValue('');
        setTranscript('');
        setHint('');
    }, []);

    const handleNextPhase = (nextPhase: LearningPhase) => {
        setPhase(nextPhase);
        resetForNextWord();
    };
    
    const handleAdvance = useCallback(() => {
        if (currentWordIndex < words.length - 1) {
            setCurrentWordIndex(prev => prev + 1);
            handleNextPhase('introduction');
        } else {
            handleNextPhase('completed');
        }
    }, [currentWordIndex, words.length]);

    const showFeedbackAndAdvance = useCallback((isCorrect: boolean) => {
        setFeedback(isCorrect ? 'correct' : 'incorrect');
        setTimeout(() => {
            if (isCorrect) {
                if (phaseRef.current === 'pronunciation') {
                    setPhase('spelling');
                    resetForNextWord();
                } else if (phaseRef.current === 'spelling') {
                    handleAdvance();
                }
            } else {
                setFeedback(null);
            }
        }, 1500);
    }, [handleAdvance, resetForNextWord]);

    const handleSpellingSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isCorrect = inputValue.trim().toLowerCase() === currentWord.cleanWord.toLowerCase();
        showFeedbackAndAdvance(isCorrect);
    };

    const startListening = () => {
        if (recognitionRef.current && !isListening) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error("Speech recognition could not start.", e);
            }
        }
    };

     const handleStartMicCheck = () => {
        if (recognitionRef.current && !isListening) {
            try {
                setMicCheckStatus('listening');
                setMicError(null);
                recognitionRef.current.start();
            } catch (e) {
                console.error("Speech recognition could not start.", e);
                setMicCheckStatus('error');
                setMicError('Could not start listening. Is another app using the microphone?');
            }
        }
    };

    useEffect(() => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
          if (phaseRef.current === 'mic-check') {
              setMicCheckStatus('error');
              setMicError('Speech Recognition is not supported by your browser.');
          }
          return;
      }
      
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => {
          setIsListening(true);
      };

      recognition.onresult = (event) => {
        if (phaseRef.current === 'mic-check') {
            setMicCheckStatus('success');
        } else if (phaseRef.current === 'pronunciation' && currentWordRef.current) {
            const result = event.results[0][0].transcript;
            setTranscript(result);
            const isCorrect = result.trim().toLowerCase() === currentWordRef.current.cleanWord.toLowerCase();
            showFeedbackAndAdvance(isCorrect);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (phaseRef.current === 'mic-check') {
            setMicCheckStatus('error');
            setMicError(`Error: ${event.error}. Please check microphone permissions in your browser settings.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (phaseRef.current === 'mic-check' && micCheckStatus !== 'success') {
            if (micCheckStatus === 'listening') {
                 setMicCheckStatus('error');
                 setMicError('No speech detected. Please try again.');
            }
        }
      };
      
      recognitionRef.current = recognition;

      return () => {
          if (recognitionRef.current) {
              recognitionRef.current.abort();
          }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 
    
    useEffect(() => {
        if (phase === 'introduction' && currentWord) {
            setTimeout(() => speak(currentWord.cleanWord), 500);
        }
    }, [phase, currentWord, speak]);
    
    const handleGetHint = async () => {
      if (!currentWord) return;
      setIsHintLoading(true);
      setHint('');
      const example = await getExampleSentence(currentWord.cleanWord);
      setHint(example);
      setIsHintLoading(false);
    };

    const renderContent = () => {
        switch (phase) {
            case 'welcome':
                return (
                    <div className="text-center">
                        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">LingoChamp</h1>
                        <p className="mt-4 text-xl text-gray-300">Ready to master new English words?</p>
                        <button
                            onClick={() => handleNextPhase('mic-check')}
                            className="mt-8 px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-full text-lg font-semibold transition-transform transform hover:scale-105"
                        >
                            Start Learning
                        </button>
                    </div>
                );

            case 'mic-check':
                return (
                    <div className="text-center w-full max-w-lg mx-auto">
                        <h2 className="text-3xl font-bold text-purple-400 mb-4">Microphone Check</h2>
                        <p className="text-gray-300 mb-8">Before we start, let's make sure I can hear you. Please click the button and say "Hello".</p>
            
                        <button
                            onClick={handleStartMicCheck}
                            disabled={isListening}
                            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 mx-auto ${isListening ? 'bg-red-500 animate-pulse' : 'bg-purple-600 hover:bg-purple-700'}`}
                            aria-label="Start microphone test"
                        >
                            <MicrophoneIcon className="w-12 h-12" />
                        </button>
                        
                        <div className="mt-4 h-20 flex flex-col items-center justify-center">
                            {micCheckStatus === 'idle' && <p className="text-gray-400">Ready to test...</p>}
                            {micCheckStatus === 'listening' && <p className="text-purple-300">Listening...</p>}
                            {micCheckStatus === 'error' && (
                                <div className="text-red-400">
                                    <p>Something went wrong.</p>
                                    <p className="text-sm">{micError}</p>
                                </div>
                            )}
                            {micCheckStatus === 'success' && (
                                <div className="text-green-400 flex flex-col items-center gap-4 animate-fade-in">
                                    <p>Great, I can hear you!</p>
                                    <button
                                        onClick={() => handleNextPhase('introduction')}
                                        className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-full font-semibold"
                                    >
                                        Continue
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            
            case 'introduction':
                return (
                    currentWord && (
                        <div className="flex flex-col items-center gap-8">
                            <WordCard word={currentWord} onSpeak={() => speak(currentWord.cleanWord)} />
                            <button
                                onClick={() => setPhase('pronunciation')}
                                className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-full text-lg font-semibold transition-transform transform hover:scale-105"
                            >
                                I'm ready to practice!
                            </button>
                        </div>
                    )
                );
            
            case 'pronunciation':
            case 'spelling':
                return (
                    currentWord && (
                        <div className="w-full max-w-lg mx-auto text-center">
                            <p className="text-gray-400 text-lg">
                                {phase === 'pronunciation' ? "How do you pronounce..." : "How do you spell..."}
                            </p>
                            <h2 className="text-5xl font-bold my-4 text-purple-400">{currentWord.cleanWord}</h2>
                            <p className="text-xl text-gray-300 mb-6">{currentWord.translation}</p>
                            
                            {phase === 'pronunciation' && (
                                <div className="flex flex-col items-center">
                                    <button
                                        onClick={startListening}
                                        disabled={isListening}
                                        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-purple-600 hover:bg-purple-700'}`}
                                        aria-label="Start pronunciation practice"
                                    >
                                        <MicrophoneIcon className="w-12 h-12" />
                                    </button>
                                    <p className="mt-4 h-6 text-gray-300">{isListening ? "Listening..." : (transcript || "Tap the mic and speak")}</p>
                                </div>
                            )}

                            {phase === 'spelling' && (
                                <form onSubmit={handleSpellingSubmit}>
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        className="w-full p-4 bg-gray-700 border-2 border-gray-600 rounded-lg text-center text-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        autoFocus
                                    />
                                    <button type="submit" className="mt-4 px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-full text-lg font-semibold">
                                        Check Spelling
                                    </button>
                                </form>
                            )}

                             <div className="mt-6">
                                <button onClick={handleGetHint} disabled={isHintLoading} className="flex items-center gap-2 mx-auto text-gray-400 hover:text-purple-300 disabled:opacity-50">
                                    <LightBulbIcon className="w-5 h-5" />
                                    {isHintLoading ? "Getting a hint..." : "Need a hint?"}
                                </button>
                                {hint && <p className="mt-2 p-3 bg-gray-800 rounded-lg text-sm text-gray-300 italic">"{hint}"</p>}
                            </div>
                        </div>
                    )
                );

            case 'completed':
                return (
                    <div className="text-center">
                        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">Congratulations!</h1>
                        <p className="mt-4 text-xl text-gray-300">You've completed all the words!</p>
                        <button
                            onClick={() => {
                                setWords([...WORDS_DATA].sort(() => Math.random() - 0.5));
                                setCurrentWordIndex(0);
                                handleNextPhase('welcome');
                            }}
                            className="mt-8 px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-full text-lg font-semibold transition-transform transform hover:scale-105"
                        >
                            Start Over
                        </button>
                    </div>
                );
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-3xl">
                {phase !== 'welcome' && phase !== 'completed' && phase !== 'mic-check' && (
                     <div className="mb-8">
                        <ProgressBar current={currentWordIndex} total={words.length} />
                    </div>
                )}
                <main className="relative flex items-center justify-center" style={{minHeight: '500px'}}>
                  <div className="transition-opacity duration-300 ease-in-out w-full">
                    {renderContent()}
                  </div>

                  {feedback && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 rounded-xl">
                      {feedback === 'correct' ? 
                        <CheckCircleIcon className="w-32 h-32 text-green-500 animate-bounce" /> : 
                        <XCircleIcon className="w-32 h-32 text-red-500" />}
                    </div>
                  )}
                </main>
            </div>
        </div>
    );
}