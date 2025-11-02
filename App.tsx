import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Word, LearningPhase, AppMode, TestQuestion, TestResult } from './types';
import { WORDS_DATA } from './constants';
import { getExampleSentence } from './services/geminiService';
import { speakWithGoogleTTS } from './services/ttsService';
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
    // App mode state
    const [appMode, setAppMode] = useState<AppMode>('menu');

    // Learning mode states
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

    // Test mode states
    const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
    const [currentTestIndex, setCurrentTestIndex] = useState(0);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [hardTestPhase, setHardTestPhase] = useState<'spelling' | 'pronunciation'>('spelling');
    const [hardSpellingCorrect, setHardSpellingCorrect] = useState(false);

    const recognitionRef = useRef<any | null>(null);
    const phaseRef = useRef(phase);
    useEffect(() => { phaseRef.current = phase }, [phase]);
    const currentWordRef = useRef(words[currentWordIndex]);
    useEffect(() => { currentWordRef.current = words[currentWordIndex] }, [words, currentWordIndex]);


    const speak = useCallback(async (text: string, lang = 'en-US') => {
        // Use Google Cloud TTS for reliable mobile support
        await speakWithGoogleTTS(text, lang);
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
        const result = event.results[0][0].transcript;
        setTranscript(result);

        if (phaseRef.current === 'mic-check') {
            setMicCheckStatus('success');
        } else if (phaseRef.current === 'pronunciation' && currentWordRef.current) {
            const isCorrect = result.trim().toLowerCase() === currentWordRef.current.cleanWord.toLowerCase();
            showFeedbackAndAdvance(isCorrect);
        }
        // For test modes, just set transcript - handlers will check it
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

    // --- Test System Functions ---

    const generateEasyTest = useCallback(() => {
        // Randomly select 10 words for easy test
        const shuffled = [...WORDS_DATA].sort(() => Math.random() - 0.5);
        const selectedWords = shuffled.slice(0, 10);

        const questions: TestQuestion[] = selectedWords.map(word => {
            // Generate 3 wrong options from other words
            const wrongOptions = WORDS_DATA
                .filter(w => w.cleanWord !== word.cleanWord)
                .sort(() => Math.random() - 0.5)
                .slice(0, 3)
                .map(w => w.cleanWord);

            // Combine and shuffle options
            const options = [word.cleanWord, ...wrongOptions].sort(() => Math.random() - 0.5);

            return {
                word,
                options,
                answered: false,
            };
        });

        setTestQuestions(questions);
        setCurrentTestIndex(0);
        setAppMode('test-easy');
    }, []);

    const generateHardTest = useCallback(() => {
        // Randomly select 20 words for hard test
        const shuffled = [...WORDS_DATA].sort(() => Math.random() - 0.5);
        const selectedWords = shuffled.slice(0, 20);

        const questions: TestQuestion[] = selectedWords.map(word => ({
            word,
            answered: false,
        }));

        setTestQuestions(questions);
        setCurrentTestIndex(0);
        setAppMode('test-hard');
    }, []);

    const finishTest = useCallback((mode: 'easy' | 'hard', questions: TestQuestion[]) => {
        let score = 0;
        let maxScore = 0;

        if (mode === 'easy') {
            maxScore = questions.length;
            score = questions.filter(q => q.userAnswer === q.word.cleanWord).length;
        } else {
            // Hard test: 2 points per question (1 for spelling, 1 for pronunciation)
            maxScore = questions.length * 2;
            questions.forEach(q => {
                if (q.spellingCorrect) score++;
                if (q.pronunciationCorrect) score++;
            });
        }

        const percentage = Math.round((score / maxScore) * 100);

        const result: TestResult = {
            mode,
            questions,
            score,
            maxScore,
            percentage,
            completedAt: new Date(),
        };

        setTestResult(result);
        setAppMode('test-results');

        // Save to localStorage
        const savedResults = localStorage.getItem('lingochamp-test-results');
        const results = savedResults ? JSON.parse(savedResults) : [];
        results.push(result);
        localStorage.setItem('lingochamp-test-results', JSON.stringify(results));
    }, []);

    const handleEasyTestAnswer = useCallback((selectedWord: string) => {
        const currentQuestion = testQuestions[currentTestIndex];
        const isCorrect = selectedWord === currentQuestion.word.cleanWord;

        // Update question
        const updatedQuestions = [...testQuestions];
        updatedQuestions[currentTestIndex] = {
            ...currentQuestion,
            userAnswer: selectedWord,
            answered: true,
        };
        setTestQuestions(updatedQuestions);

        // Show feedback
        setFeedback(isCorrect ? 'correct' : 'incorrect');

        setTimeout(() => {
            setFeedback(null);
            // Move to next question or finish
            if (currentTestIndex < testQuestions.length - 1) {
                setCurrentTestIndex(prev => prev + 1);
            } else {
                finishTest('easy', updatedQuestions);
            }
        }, 1500);
    }, [testQuestions, currentTestIndex, finishTest]);

    const handleHardTestSubmit = useCallback((spellingCorrect: boolean, pronunciationCorrect: boolean) => {
        const currentQuestion = testQuestions[currentTestIndex];

        // Update question
        const updatedQuestions = [...testQuestions];
        updatedQuestions[currentTestIndex] = {
            ...currentQuestion,
            spellingCorrect,
            pronunciationCorrect,
            answered: true,
        };
        setTestQuestions(updatedQuestions);

        // Show feedback
        setFeedback(spellingCorrect && pronunciationCorrect ? 'correct' : 'incorrect');

        setTimeout(() => {
            setFeedback(null);
            setInputValue('');
            setTranscript('');
            // Move to next question or finish
            if (currentTestIndex < testQuestions.length - 1) {
                setCurrentTestIndex(prev => prev + 1);
            } else {
                finishTest('hard', updatedQuestions);
            }
        }, 1500);
    }, [testQuestions, currentTestIndex, finishTest]);

    const startLearning = useCallback(() => {
        setWords([...WORDS_DATA].sort(() => Math.random() - 0.5));
        setCurrentWordIndex(0);
        setPhase('welcome');
        setAppMode('learning');
    }, []);

    const renderContent = () => {
        // Main Menu
        if (appMode === 'menu') {
            return (
                <div className="text-center">
                    <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500 mb-8">LingoChamp</h1>
                    <p className="text-xl text-gray-300 mb-12">Choose your learning mode</p>
                    <div className="grid gap-6 max-w-md mx-auto">
                        <button
                            onClick={startLearning}
                            className="p-6 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 shadow-lg"
                        >
                            <div className="text-2xl mb-2">📚</div>
                            <div>Learning Mode</div>
                            <div className="text-sm text-purple-200 mt-2">Learn new words step by step</div>
                        </button>
                        <button
                            onClick={generateEasyTest}
                            className="p-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 shadow-lg"
                        >
                            <div className="text-2xl mb-2">🎯</div>
                            <div>Easy Test</div>
                            <div className="text-sm text-green-200 mt-2">10 questions - Multiple choice + pronunciation</div>
                        </button>
                        <button
                            onClick={generateHardTest}
                            className="p-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 shadow-lg"
                        >
                            <div className="text-2xl mb-2">🔥</div>
                            <div>Hard Test</div>
                            <div className="text-sm text-red-200 mt-2">20 questions - Type + pronounce each word</div>
                        </button>
                    </div>
                </div>
            );
        }

        // Easy Test Mode
        if (appMode === 'test-easy') {
            const currentQuestion = testQuestions[currentTestIndex];
            if (!currentQuestion) return null;

            return (
                <div className="w-full max-w-lg mx-auto text-center">
                    <div className="mb-6">
                        <p className="text-gray-400">Question {currentTestIndex + 1} of {testQuestions.length}</p>
                        <ProgressBar current={currentTestIndex} total={testQuestions.length} />
                    </div>
                    <h2 className="text-3xl font-bold text-purple-400 mb-2">Easy Test</h2>
                    <p className="text-gray-300 mb-6">Choose the correct English word</p>

                    <div className="bg-gray-800 p-6 rounded-xl mb-6">
                        <p className="text-gray-400 text-sm mb-2">Lithuanian word:</p>
                        <h3 className="text-4xl font-bold text-white">{currentQuestion.word.translation}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {currentQuestion.options?.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => handleEasyTestAnswer(option)}
                                className="p-4 bg-gray-700 hover:bg-purple-600 rounded-lg text-lg font-semibold transition-all transform hover:scale-105"
                            >
                                {option}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setAppMode('menu')}
                        className="mt-8 text-gray-400 hover:text-white underline"
                    >
                        Back to Menu
                    </button>
                </div>
            );
        }

        // Hard Test Mode
        if (appMode === 'test-hard') {
            const currentQuestion = testQuestions[currentTestIndex];
            if (!currentQuestion) return null;

            const handleHardSpellingCheck = (e: React.FormEvent) => {
                e.preventDefault();
                const isCorrect = inputValue.trim().toLowerCase() === currentQuestion.word.cleanWord.toLowerCase();
                setHardSpellingCorrect(isCorrect);
                setFeedback(isCorrect ? 'correct' : 'incorrect');
                setTimeout(() => {
                    setFeedback(null);
                    setHardTestPhase('pronunciation');
                }, 1500);
            };

            const handlePronunciationNext = () => {
                const pronunciationCorrect = transcript.trim().toLowerCase() === currentQuestion.word.cleanWord.toLowerCase();
                handleHardTestSubmit(hardSpellingCorrect, pronunciationCorrect);
                setHardTestPhase('spelling');
                setInputValue('');
                setTranscript('');
            };

            return (
                <div className="w-full max-w-lg mx-auto text-center">
                    <div className="mb-6">
                        <p className="text-gray-400">Question {currentTestIndex + 1} of {testQuestions.length}</p>
                        <ProgressBar current={currentTestIndex} total={testQuestions.length} />
                    </div>
                    <h2 className="text-3xl font-bold text-red-400 mb-2">Hard Test</h2>
                    <p className="text-gray-300 mb-6">{hardTestPhase === 'spelling' ? 'Type the word' : 'Now pronounce it'}</p>

                    <div className="bg-gray-800 p-6 rounded-xl mb-6">
                        <p className="text-gray-400 text-sm mb-2">Lithuanian word:</p>
                        <h3 className="text-4xl font-bold text-white">{currentQuestion.word.translation}</h3>
                    </div>

                    {hardTestPhase === 'spelling' && (
                        <form onSubmit={handleHardSpellingCheck}>
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="w-full p-4 bg-gray-700 border-2 border-gray-600 rounded-lg text-center text-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                placeholder="Type English word..."
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="mt-4 px-8 py-3 bg-red-600 hover:bg-red-700 rounded-full text-lg font-semibold"
                            >
                                Check Spelling
                            </button>
                        </form>
                    )}

                    {hardTestPhase === 'pronunciation' && (
                        <div className="flex flex-col items-center">
                            <button
                                onClick={startListening}
                                disabled={isListening}
                                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                <MicrophoneIcon className="w-12 h-12" />
                            </button>
                            <p className="mt-4 h-6 text-gray-300">{isListening ? "Listening..." : (transcript || "Tap to pronounce")}</p>
                            {transcript && (
                                <button
                                    onClick={handlePronunciationNext}
                                    className="mt-6 px-8 py-3 bg-green-600 hover:bg-green-700 rounded-full text-lg font-semibold"
                                >
                                    Next Question
                                </button>
                            )}
                        </div>
                    )}

                    <button
                        onClick={() => {
                            setAppMode('menu');
                            setHardTestPhase('spelling');
                        }}
                        className="mt-8 text-gray-400 hover:text-white underline"
                    >
                        Exit Test
                    </button>
                </div>
            );
        }

        // Test Results
        if (appMode === 'test-results' && testResult) {
            const getGrade = (percentage: number) => {
                if (percentage >= 90) return { grade: 'A+', color: 'text-green-400', emoji: '🌟' };
                if (percentage >= 80) return { grade: 'A', color: 'text-green-400', emoji: '✨' };
                if (percentage >= 70) return { grade: 'B', color: 'text-blue-400', emoji: '👍' };
                if (percentage >= 60) return { grade: 'C', color: 'text-yellow-400', emoji: '📚' };
                return { grade: 'D', color: 'text-red-400', emoji: '💪' };
            };

            const gradeInfo = getGrade(testResult.percentage);

            return (
                <div className="w-full max-w-2xl mx-auto text-center">
                    <h1 className="text-5xl font-bold mb-2">{gradeInfo.emoji}</h1>
                    <h2 className="text-4xl font-bold mb-4">Test Complete!</h2>

                    <div className="bg-gray-800 p-8 rounded-xl mb-6">
                        <div className="text-6xl font-bold mb-4">
                            <span className={gradeInfo.color}>{gradeInfo.grade}</span>
                        </div>
                        <p className="text-3xl font-bold mb-2">{testResult.percentage}%</p>
                        <p className="text-xl text-gray-400">Score: {testResult.score} / {testResult.maxScore}</p>
                        <p className="text-sm text-gray-500 mt-4">
                            {testResult.mode === 'easy' ? 'Easy Test' : 'Hard Test'} - {testResult.questions.length} questions
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <button
                            onClick={() => testResult.mode === 'easy' ? generateEasyTest() : generateHardTest()}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-full text-lg font-semibold transition-all transform hover:scale-105"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => setAppMode('menu')}
                            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-full text-lg font-semibold transition-all transform hover:scale-105"
                        >
                            Main Menu
                        </button>
                    </div>

                    <details className="text-left bg-gray-800 p-4 rounded-lg">
                        <summary className="cursor-pointer font-semibold mb-4">View Details</summary>
                        <div className="space-y-3">
                            {testResult.questions.map((q, idx) => (
                                <div key={idx} className="border-l-4 pl-3 py-2" style={{ borderColor: q.userAnswer === q.word.cleanWord || (q.spellingCorrect && q.pronunciationCorrect) ? '#10b981' : '#ef4444' }}>
                                    <p className="font-semibold">{q.word.translation}</p>
                                    <p className="text-sm text-gray-400">Correct: {q.word.cleanWord}</p>
                                    {testResult.mode === 'easy' && (
                                        <p className="text-sm">Your answer: <span className={q.userAnswer === q.word.cleanWord ? 'text-green-400' : 'text-red-400'}>{q.userAnswer}</span></p>
                                    )}
                                    {testResult.mode === 'hard' && (
                                        <div className="text-sm">
                                            <p>Spelling: <span className={q.spellingCorrect ? 'text-green-400' : 'text-red-400'}>{q.spellingCorrect ? '✓' : '✗'}</span></p>
                                            <p>Pronunciation: <span className={q.pronunciationCorrect ? 'text-green-400' : 'text-red-400'}>{q.pronunciationCorrect ? '✓' : '✗'}</span></p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </details>
                </div>
            );
        }

        // Learning Mode
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
                        <div className="grid grid-cols-2 gap-4 mt-8 max-w-md mx-auto">
                            <button
                                onClick={() => {
                                    setWords([...WORDS_DATA].sort(() => Math.random() - 0.5));
                                    setCurrentWordIndex(0);
                                    handleNextPhase('welcome');
                                }}
                                className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-full text-lg font-semibold transition-transform transform hover:scale-105"
                            >
                                Start Over
                            </button>
                            <button
                                onClick={() => setAppMode('menu')}
                                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-full text-lg font-semibold transition-transform transform hover:scale-105"
                            >
                                Main Menu
                            </button>
                        </div>
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