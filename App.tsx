import React, { useState, useEffect, useRef } from 'react';
import { Heart, RefreshCw, Trophy, AlertCircle, Settings, BrainCircuit, Zap, Clock, Upload, FileText, X } from 'lucide-react';
import { GameConfig, GameStatus, CardItem, LANGUAGES, TOPICS, DIFFICULTIES, VocabularyPair } from './types';
import { generateVocabulary } from './services/geminiService';
import { parseDeckFile } from './services/importService';
import { Card } from './components/Card';
import { ProgressBar } from './components/ProgressBar';

const INITIAL_HEARTS = 5;
const BOARD_ROWS = 5;

const App: React.FC = () => {
  // Game Configuration
  const [status, setStatus] = useState<GameStatus>('setup');
  const [config, setConfig] = useState<GameConfig>({
    language: 'Spanish',
    difficulty: 'Beginner',
    topic: 'Basics'
  });
  
  // Custom Deck State
  const [customDeck, setCustomDeck] = useState<VocabularyPair[] | null>(null);
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Game Board State
  const [deck, setDeck] = useState<VocabularyPair[]>([]);
  const [leftSlots, setLeftSlots] = useState<(CardItem | null)[]>(new Array(BOARD_ROWS).fill(null));
  const [rightSlots, setRightSlots] = useState<(CardItem | null)[]>(new Array(BOARD_ROWS).fill(null));
  
  // Game Play State
  const [hearts, setHearts] = useState(INITIAL_HEARTS);
  const [matchesFound, setMatchesFound] = useState(0);
  const [totalPairs, setTotalPairs] = useState(0); 
  const [targetScore, setTargetScore] = useState(0);
  
  // Selection
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // IRT / Statistics
  const mistakesRef = useRef<Record<string, number>>({});
  
  // High Score & Timing
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [finalTime, setFinalTime] = useState<number>(0);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load best time
  useEffect(() => {
    if (customDeck) {
      setBestTime(null); // No leaderboards for custom decks yet
      return;
    }
    const key = `lingo_best_${config.language}_${config.topic}_${config.difficulty}`;
    const saved = localStorage.getItem(key);
    setBestTime(saved ? parseFloat(saved) : null);
  }, [config, customDeck]);

  // Live Timer
  useEffect(() => {
    let interval: number;
    if (status === 'playing') {
      interval = window.setInterval(() => {
        setElapsedTime((Date.now() - startTime) / 1000);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [status, startTime]);

  // Win/Loss Condition Checks
  useEffect(() => {
    if (status !== 'playing') return;

    if (matchesFound >= targetScore && targetScore > 0) {
       finishGame('won');
    }
    
    // Loss
    if (hearts <= 0) {
      finishGame('lost');
    }
  }, [matchesFound, targetScore, hearts, status]);

  const finishGame = (result: 'won' | 'lost') => {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    setFinalTime(duration);
    
    if (result === 'won' && !customDeck) {
       const key = `lingo_best_${config.language}_${config.topic}_${config.difficulty}`;
       const saved = localStorage.getItem(key);
       const currentBest = saved ? parseFloat(saved) : Infinity;

       if (duration < currentBest) {
         localStorage.setItem(key, duration.toFixed(2));
         setIsNewRecord(true);
         setBestTime(duration);
       } else {
         setIsNewRecord(false);
       }
    }
    setStatus(result);
  };

  const handleConfigChange = (key: keyof GameConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    try {
      const pairs = await parseDeckFile(file);
      setCustomDeck(pairs);
      setCustomFileName(file.name);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to import file");
      setCustomDeck(null);
      setCustomFileName(null);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearCustomDeck = () => {
    setCustomDeck(null);
    setCustomFileName(null);
  };

  const startGame = async () => {
    setStatus('loading');
    setErrorMsg(null);
    try {
      let vocab: VocabularyPair[];
      
      if (customDeck) {
        // Use custom deck (shuffle it first)
        vocab = [...customDeck];
        // Fisher-Yates Shuffle for custom deck to randomise order
        for (let i = vocab.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [vocab[i], vocab[j]] = [vocab[j], vocab[i]];
        }
        // Limit if too huge? Maybe max 50 for a session
        vocab = vocab.slice(0, 50); 
      } else {
        vocab = await generateVocabulary(config);
      }
      
      const initialDeck = [...vocab];
      const initialLeft = new Array(BOARD_ROWS).fill(null);
      const initialRight = new Array(BOARD_ROWS).fill(null);
      
      // Reset Stats
      mistakesRef.current = {};

      // Fill the board initially (take first 5 pairs)
      const availableIndices = Array.from({length: BOARD_ROWS}, (_, i) => i);
      const startCount = Math.min(BOARD_ROWS, initialDeck.length);
      const startPairs = initialDeck.splice(0, startCount);

      // Shuffled indices for initial placement
      let leftIndices = [...availableIndices];
      for (let i = leftIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [leftIndices[i], leftIndices[j]] = [leftIndices[j], leftIndices[i]];
      }
      
      let rightIndices = [...availableIndices];
      for (let i = rightIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rightIndices[i], rightIndices[j]] = [rightIndices[j], rightIndices[i]];
      }

      startPairs.forEach((pair, idx) => {
        const uniqueId = Math.random().toString(36).substr(2, 9);
        const swap = Math.random() > 0.5; // Randomize which column gets target vs native
        
        initialLeft[leftIndices[idx]] = {
          id: `l-${uniqueId}`,
          text: swap ? pair.native : pair.target,
          pairId: pair.target + pair.native, // Unique match key
          type: swap ? 'native' : 'target',
          state: 'idle'
        };
        initialRight[rightIndices[idx]] = {
          id: `r-${uniqueId}`,
          text: swap ? pair.target : pair.native,
          pairId: pair.target + pair.native,
          type: swap ? 'target' : 'native',
          state: 'idle'
        };
      });

      setDeck(initialDeck);
      setLeftSlots(initialLeft);
      setRightSlots(initialRight);
      setTotalPairs(vocab.length);
      setTargetScore(vocab.length);
      setMatchesFound(0);
      setHearts(INITIAL_HEARTS);
      setSelectedLeft(null);
      setSelectedRight(null);
      setElapsedTime(0);
      setStartTime(Date.now());
      setStatus('playing');
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to start game. Please try again.");
      setStatus('setup');
    }
  };

  const scheduleRefill = (pairToInsert: VocabularyPair) => {
    // Random delay between 1.5s and 3.5s
    const delay = Math.random() * 2000 + 1500;
    
    setTimeout(() => {
      const swap = Math.random() > 0.5;

      setLeftSlots(prevLeft => {
        const emptyIndices = prevLeft.map((item, idx) => item === null ? idx : -1).filter(i => i !== -1);
        if (emptyIndices.length === 0) return prevLeft;
        
        const randomIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        const newLeft = [...prevLeft];
        
        const uniqueId = Math.random().toString(36).substr(2, 9);
        newLeft[randomIdx] = {
           id: `l-${uniqueId}`,
           text: swap ? pairToInsert.native : pairToInsert.target,
           pairId: pairToInsert.target + pairToInsert.native,
           type: swap ? 'native' : 'target',
           state: 'idle'
        };
        return newLeft;
      });

      setRightSlots(prevRight => {
        const emptyIndices = prevRight.map((item, idx) => item === null ? idx : -1).filter(i => i !== -1);
        if (emptyIndices.length === 0) return prevRight;
        
        const randomIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        const newRight = [...prevRight];
        
        const uniqueId = Math.random().toString(36).substr(2, 9);
        newRight[randomIdx] = {
           id: `r-${uniqueId}`,
           text: swap ? pairToInsert.target : pairToInsert.native,
           pairId: pairToInsert.target + pairToInsert.native,
           type: swap ? 'target' : 'native',
           state: 'idle'
        };
        return newRight;
      });
      
    }, delay);
  };

  const handleCardClick = (item: CardItem, index: number, col: 'left' | 'right') => {
    if (isProcessing || status !== 'playing' || item.state !== 'idle') return;

    if (col === 'left') {
      if (selectedLeft === index) {
        setLeftSlots(prev => prev.map((c, i) => i === index && c ? { ...c, state: 'idle' } : c));
        setSelectedLeft(null);
        return;
      }
      if (selectedLeft !== null) {
        setLeftSlots(prev => prev.map((c, i) => i === selectedLeft && c ? { ...c, state: 'idle' } : c));
      }
      setLeftSlots(prev => prev.map((c, i) => i === index && c ? { ...c, state: 'selected' } : c));
      setSelectedLeft(index);
      
      if (selectedRight !== null) checkMatch(index, selectedRight);
    } else {
      if (selectedRight === index) {
        setRightSlots(prev => prev.map((c, i) => i === index && c ? { ...c, state: 'idle' } : c));
        setSelectedRight(null);
        return;
      }
      if (selectedRight !== null) {
        setRightSlots(prev => prev.map((c, i) => i === selectedRight && c ? { ...c, state: 'idle' } : c));
      }
      setRightSlots(prev => prev.map((c, i) => i === index && c ? { ...c, state: 'selected' } : c));
      setSelectedRight(index);

      if (selectedLeft !== null) checkMatch(selectedLeft, index);
    }
  };

  const checkMatch = (lIndex: number, rIndex: number) => {
    setIsProcessing(true);
    const leftCard = leftSlots[lIndex];
    const rightCard = rightSlots[rIndex];

    if (!leftCard || !rightCard) {
      setIsProcessing(false);
      return;
    }

    const isMatch = leftCard.pairId === rightCard.pairId;

    if (isMatch) {
      // Show Match Animation (Green)
      setLeftSlots(prev => prev.map((c, i) => i === lIndex && c ? { ...c, state: 'matched' } : c));
      setRightSlots(prev => prev.map((c, i) => i === rIndex && c ? { ...c, state: 'matched' } : c));
      
      // CHECK MISTAKES & RE-QUEUE LOGIC (IRT)
      const pairId = leftCard.pairId;
      const mistakes = mistakesRef.current[pairId] || 0;
      let isReview = false;

      // If user struggled with this word, we re-queue it (Spaced Repetition)
      if (mistakes > 0) {
        isReview = true;
        // Decrement penalty, so they can eventually clear it
        mistakesRef.current[pairId] = Math.max(0, mistakes - 1);
      } else {
        // Only increment score if mastered (no pending mistakes)
        setMatchesFound(prev => prev + 1);
      }

      // Wait then clear slots
      setTimeout(() => {
        setLeftSlots(prev => {
           const next = [...prev];
           next[lIndex] = null;
           return next;
        });
        setRightSlots(prev => {
           const next = [...prev];
           next[rIndex] = null;
           return next;
        });
        
        setSelectedLeft(null);
        setSelectedRight(null);
        setIsProcessing(false);

        // TRIGGER REFILL
        setDeck(prevDeck => {
          let newDeck = [...prevDeck];
          
          if (isReview) {
            // Reconstruct the pair object
            const targetText = leftCard.type === 'target' ? leftCard.text : rightCard.text;
            const nativeText = leftCard.type === 'native' ? leftCard.text : rightCard.text;
            const reviewPair = { target: targetText, native: nativeText };

            // Insert into random position in the top 3 slots to appear soon
            const insertIdx = Math.floor(Math.random() * Math.min(newDeck.length + 1, 3));
            newDeck.splice(insertIdx, 0, reviewPair);
          }

          if (newDeck.length > 0) {
            const nextPair = newDeck[0];
            const remainingDeck = newDeck.slice(1);
            // Schedule the refill for this pair
            scheduleRefill(nextPair);
            return remainingDeck;
          }
          return newDeck;
        });

      }, 600); 
    } else {
      // No Match - Error Animation
      setLeftSlots(prev => prev.map((c, i) => i === lIndex && c ? { ...c, state: 'wrong' } : c));
      setRightSlots(prev => prev.map((c, i) => i === rIndex && c ? { ...c, state: 'wrong' } : c));
      
      // RECORD MISTAKE (IRT)
      if (leftCard?.pairId) {
        mistakesRef.current[leftCard.pairId] = (mistakesRef.current[leftCard.pairId] || 0) + 1;
      }
      if (rightCard?.pairId && rightCard.pairId !== leftCard?.pairId) {
         mistakesRef.current[rightCard.pairId] = (mistakesRef.current[rightCard.pairId] || 0) + 1;
      }

      setHearts(h => h - 1);

      setTimeout(() => {
        setLeftSlots(prev => prev.map((c, i) => i === lIndex && c ? { ...c, state: 'idle' } : c));
        setRightSlots(prev => prev.map((c, i) => i === rIndex && c ? { ...c, state: 'idle' } : c));
        setSelectedLeft(null);
        setSelectedRight(null);
        setIsProcessing(false);
      }, 800);
    }
  };

  // --- Render Sections ---

  if (status === 'setup') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-lingo-green rounded-3xl rotate-3">
              <BrainCircuit size={64} className="text-white" />
            </div>
          </div>
          
          <h1 className="text-3xl font-extrabold text-lingo-text mb-2">LingoMatch AI</h1>
          <p className="text-gray-500 text-lg mb-4">Match pairs in an endless stream!</p>

          {bestTime !== null && !customDeck && (
            <div className="flex items-center justify-center gap-2 text-yellow-600 font-bold bg-yellow-50 py-2 px-4 rounded-xl mx-auto w-fit border border-yellow-100">
              <Trophy size={18} className="fill-yellow-600" />
              <span className="text-sm uppercase tracking-wide">Best: {bestTime.toFixed(1)}s</span>
            </div>
          )}

          <div className="space-y-4 pt-4">
            {customDeck ? (
              <div className="bg-sky-50 border-2 border-sky-100 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="text-lingo-blue" />
                  <div className="text-left">
                    <div className="text-xs text-sky-500 font-bold uppercase">Custom Deck</div>
                    <div className="text-lingo-text font-bold text-lg truncate max-w-[150px]">{customFileName}</div>
                    <div className="text-xs text-gray-500">{customDeck.length} pairs</div>
                  </div>
                </div>
                <button 
                  onClick={clearCustomDeck}
                  className="p-2 hover:bg-sky-100 rounded-full text-sky-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2 text-left">
                  <label className="text-sm font-bold text-gray-400 uppercase tracking-wide">I want to learn</label>
                  <select 
                    value={config.language}
                    onChange={(e) => handleConfigChange('language', e.target.value)}
                    className="w-full p-4 border-2 border-gray-200 rounded-2xl bg-white text-lg font-bold text-gray-700 focus:outline-none focus:border-lingo-blue"
                  >
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>

                <div className="space-y-2 text-left">
                   <label className="text-sm font-bold text-gray-400 uppercase tracking-wide">Topic</label>
                  <select 
                    value={config.topic}
                    onChange={(e) => handleConfigChange('topic', e.target.value)}
                    className="w-full p-4 border-2 border-gray-200 rounded-2xl bg-white text-lg font-bold text-gray-700 focus:outline-none focus:border-lingo-blue"
                  >
                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="space-y-2 text-left">
                   <label className="text-sm font-bold text-gray-400 uppercase tracking-wide">Difficulty</label>
                  <select 
                    value={config.difficulty}
                    onChange={(e) => handleConfigChange('difficulty', e.target.value)}
                    className="w-full p-4 border-2 border-gray-200 rounded-2xl bg-white text-lg font-bold text-gray-700 focus:outline-none focus:border-lingo-blue"
                  >
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          {errorMsg && (
            <div className="p-4 bg-red-100 text-red-600 rounded-xl flex items-center gap-2 text-sm font-bold">
              <AlertCircle size={20} />
              {errorMsg}
            </div>
          )}

          <div className="space-y-3 mt-8">
            <button 
              onClick={startGame}
              className="w-full py-4 bg-lingo-green text-white text-xl font-extrabold rounded-2xl shadow-[0_4px_0_0_#46a302] active:shadow-none active:translate-y-1 transition-all uppercase tracking-wider"
            >
              Start Match Madness
            </button>

            {!customDeck && (
              <div className="relative">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".csv,.apkg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 bg-white border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors uppercase tracking-wide text-sm"
                >
                  <Upload size={18} />
                  Import Deck (.csv / .apkg)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 space-y-6">
        <div className="animate-bounce p-4 bg-lingo-blue rounded-full">
           <RefreshCw size={48} className="text-white animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-gray-400">Constructing Lesson...</h2>
        <p className="text-gray-400">
           {customDeck 
             ? `Loading ${customDeck.length} custom pairs...` 
             : `Our AI is preparing 20 pairs of ${config.language} cards.`
           }
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-2xl mx-auto">
      {/* Header */}
      <div className="p-4 flex items-center gap-4 sticky top-0 bg-white/95 backdrop-blur-sm z-20 border-b border-gray-100 shadow-sm">
        <div className="cursor-pointer hover:bg-gray-100 p-2 rounded-xl transition-colors" onClick={() => setStatus('setup')}>
           <Settings className="text-gray-300" />
        </div>
        
        <div className="flex-1 flex items-center gap-4">
          <ProgressBar current={matchesFound} total={targetScore} />
          <div className="flex items-center gap-1 text-gray-400 font-bold font-mono min-w-[60px]">
            <Clock size={18} />
            <span>{(status === 'playing' ? elapsedTime : finalTime).toFixed(0)}s</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-lingo-red font-bold text-lg">
          <Heart fill="currentColor" size={24} className={hearts <= 2 ? 'animate-pulse' : ''} />
          <span>{hearts}</span>
        </div>
      </div>

      {/* Game Board */}
      <div className="flex-1 p-4 pb-12 overflow-y-hidden flex flex-col justify-center">
        {(status === 'won' || status === 'lost') ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6 animate-pop">
              {status === 'won' ? (
                <>
                  <Trophy size={80} className="text-yellow-400 fill-yellow-100" />
                  <h2 className="text-4xl font-extrabold text-lingo-green text-center">Lesson Complete!</h2>
                  
                  <div className="flex flex-col items-center gap-2 bg-gray-50 p-6 rounded-2xl w-full max-w-xs">
                    <div className="text-gray-400 text-sm font-bold uppercase tracking-widest">Time</div>
                    <div className="text-5xl font-black text-lingo-text">
                        {finalTime.toFixed(1)}s
                    </div>
                    {!customDeck && isNewRecord ? (
                        <div className="flex items-center gap-2 text-orange-500 text-lg font-bold animate-pulse mt-2">
                            <Zap size={20} fill="currentColor" />
                            NEW PERSONAL BEST!
                        </div>
                    ) : (
                         bestTime && !customDeck && (
                            <div className="flex items-center gap-1 text-gray-400 font-bold mt-2 text-sm">
                                <Trophy size={14} />
                                Best: {bestTime.toFixed(1)}s
                            </div>
                        )
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-6xl">💔</div>
                  <h2 className="text-4xl font-extrabold text-lingo-text text-center">Out of Hearts</h2>
                  <p className="text-gray-500 text-lg font-bold">Don't give up! Try again.</p>
                  
                  <div className="flex flex-col items-center gap-2 bg-gray-50 p-6 rounded-2xl w-full max-w-xs">
                     <div className="text-gray-400 text-sm font-bold uppercase tracking-widest">Time Spent</div>
                     <div className="text-3xl font-black text-gray-400">
                        {finalTime.toFixed(1)}s
                    </div>
                  </div>
                </>
              )}
              
              <div className="w-full max-w-xs space-y-3 pt-8">
                 <button 
                  onClick={() => setStatus('setup')}
                  className="w-full py-3 bg-lingo-blue text-white font-bold rounded-2xl shadow-[0_4px_0_0_#1899d6] active:shadow-none active:translate-y-1 transition-all uppercase"
                >
                  New Topic
                </button>
                <button 
                  onClick={startGame}
                  className="w-full py-3 bg-white border-2 border-gray-200 text-gray-400 font-bold rounded-2xl hover:bg-gray-50 uppercase"
                >
                  Retry Same
                </button>
              </div>
            </div>
        ) : (
          <div className="w-full max-w-lg mx-auto grid grid-cols-2 gap-4 h-full max-h-[600px]">
             {/* Left Column */}
             <div className="flex flex-col gap-3 justify-between">
                {leftSlots.map((card, idx) => (
                  <Card 
                    key={`l-${idx}`}
                    item={card}
                    onClick={() => handleCardClick(card!, idx, 'left')}
                    disabled={status !== 'playing' || isProcessing || !card}
                    column="left"
                  />
                ))}
             </div>

             {/* Right Column */}
             <div className="flex flex-col gap-3 justify-between">
                {rightSlots.map((card, idx) => (
                  <Card 
                    key={`r-${idx}`}
                    item={card}
                    onClick={() => handleCardClick(card!, idx, 'right')}
                    disabled={status !== 'playing' || isProcessing || !card}
                    column="right"
                  />
                ))}
             </div>
          </div>
        )}
      </div>
      
      {/* Bottom info area (only when playing) */}
      {status === 'playing' && (
        <div className="p-4 text-center text-gray-300 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2">
           Match items from left and right
        </div>
      )}
    </div>
  );
};

export default App;