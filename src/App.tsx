import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Info, 
  Volume2, 
  VolumeX, 
  Minus, 
  Plus, 
  Trophy, 
  Star, 
  X,
  RotateCw
} from 'lucide-react';

/**
 * CONFIGURATION
 */
const CONFIG = {
  RTP: 0.92,
  NEAR_MISS_RATE: 0.25,
  STARTING_CREDITS: 1000,
  BET_OPTIONS: [10, 25, 50, 100],
  REEL_COUNT: 5,
  ROW_COUNT: 3,
  REEL_VISUAL_COUNT: 15, // Total symbols in the strip for animation
  SPIN_DURATION: 1800,
  REEL_DELAY: 300,
  SUSPENSE_REEL: 2, // Index of reel to slow down (3rd reel)
  FREE_SPINS_MULTIPLIER: 3,
  FREE_SPINS_TRIGGER_COUNT: 3,
  FREE_SPINS_REWARD: 10,
};

const SYMBOLS = [
  { id: 'wild', name: 'Golden Star', icon: 'stars', value: 50, weight: 2, color: '#f2ca50', premium: true },
  { id: 'scatter', name: 'Gilded Key', icon: 'vpn_key', value: 0, weight: 4, color: '#f2ca50', isScatter: true },
  { id: 'diamond', name: 'Diamond', icon: 'diamond', value: 25, weight: 5, color: '#baf0be' },
  { id: 'seven', name: 'Lucky 7', icon: 'looks_7', value: 15, weight: 8, color: '#ff4444' },
  { id: 'bell', name: 'Bell', icon: 'notifications', value: 10, weight: 12, color: '#fbbc00' },
  { id: 'bar3', name: 'Triple Bar', icon: 'bar_triple', value: 5, weight: 15, color: '#99907c' },
  { id: 'bar2', name: 'Double Bar', icon: 'bar_double', value: 3, weight: 20, color: '#99907c' },
  { id: 'bar1', name: 'Single Bar', icon: 'bar_single', value: 2, weight: 25, color: '#99907c' },
  { id: 'cherry', name: 'Cherry', icon: 'eco', value: 1, weight: 35, color: '#ff4444' }
];

const PAYOUTS: Record<number, number> = {
  3: 3,
  4: 15,
  5: 90
};

// Sound Manager using Web Audio API
class SoundManager {
  ctx: AudioContext | null = null;
  isMuted: boolean = false;
  masterGain: GainNode | null = null;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.3;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : 0.3;
    }
    return this.isMuted;
  }

  createOscillator(freq: number, type: OscillatorType = 'sine', duration = 0.1, gainValue = 0.1) {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    if (this.masterGain) gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playSpinStart() {
    this.init();
    this.createOscillator(150, 'square', 0.15, 0.1);
    this.createOscillator(80, 'sine', 0.2, 0.2);
  }

  playReelStop(index: number) {
    this.init();
    const freq = 200 - (index * 20);
    this.createOscillator(freq, 'triangle', 0.1, 0.15);
  }

  playNearMiss() {
    this.init();
    this.createOscillator(880, 'sine', 0.5, 0.1);
    setTimeout(() => this.createOscillator(932, 'sine', 0.4, 0.08), 50);
  }

  playLDW() {
    this.init();
    [440, 554, 659].forEach((f, i) => {
      setTimeout(() => this.createOscillator(f, 'sine', 0.3, 0.1), i * 100);
    });
  }

  playSmallWin() {
    this.init();
    [523, 659, 783, 1046].forEach((f, i) => {
      setTimeout(() => this.createOscillator(f, 'sine', 0.4, 0.1), i * 80);
    });
  }

  playBigWin() {
    this.init();
    const notes = [523, 659, 783, 1046, 1318, 1567];
    notes.forEach((f, i) => {
      setTimeout(() => this.createOscillator(f, 'square', 0.5, 0.05), i * 120);
    });
  }

  playMegaWin() {
    this.init();
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        const f = 200 + (i * 100);
        this.createOscillator(f, 'sawtooth', 0.6, 0.03);
      }, i * 100);
    }
  }

  playTone(freq: number, type: OscillatorType = 'sine', duration = 0.1, gainValue = 0.1) {
    this.init();
    this.createOscillator(freq, type, duration, gainValue);
  }
}

const sounds = new SoundManager();

export default function App() {
  const [credits, setCredits] = useState(CONFIG.STARTING_CREDITS);
  const [betIndex, setBetIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const isSpinningRef = useRef(false);
  const [spinningReels, setSpinningReels] = useState<boolean[]>([false, false, false, false, false]);
  const [reels, setReels] = useState<any[][]>([]);
  const [win, setWin] = useState<any>(null);
  const [showPaytable, setShowPaytable] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [suspenseActive, setSuspenseActive] = useState(false);
  const [winningIndices, setWinningIndices] = useState<number[]>([]);
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const [totalFreeSpinWin, setTotalFreeSpinWin] = useState(0);
  const [showFreeSpinsIntro, setShowFreeSpinsIntro] = useState(false);
  const [showFreeSpinsOutro, setShowFreeSpinsOutro] = useState(false);

  const bet = CONFIG.BET_OPTIONS[betIndex];
  const isFreeSpinMode = freeSpinsRemaining > 0;

  // Initialize reels
  useEffect(() => {
    const initialReels = Array(CONFIG.REEL_COUNT).fill(0).map(() => 
      generateFullReel(Array(CONFIG.ROW_COUNT).fill(0).map(() => getRandomSymbol()))
    );
    setReels(initialReels);

    const timer = setTimeout(() => setIsLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const getRandomSymbol = () => {
    const totalWeight = SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
    let random = Math.random() * totalWeight;
    for (const s of SYMBOLS) {
      if (random < s.weight) return s;
      random -= s.weight;
    }
    return SYMBOLS[SYMBOLS.length - 1];
  };

  const generateFullReel = (baseSymbols: any[]) => {
    const fullReel = [...baseSymbols];
    // Add random symbols until we reach REEL_VISUAL_COUNT - 3
    while (fullReel.length < CONFIG.REEL_VISUAL_COUNT - 3) {
      fullReel.push(getRandomSymbol());
    }
    // Add the first 3 symbols again at the end for seamless looping
    fullReel.push(baseSymbols[0], baseSymbols[1], baseSymbols[2]);
    return fullReel;
  };

  const calculateWin = useCallback((currentReels: any[][]) => {
    const payline = currentReels.map(reel => reel[1]); // Middle row
    let bestWin = { 
      amount: 0, 
      type: 'NONE', 
      symbol: null, 
      count: 0, 
      winningIndices: [] as number[],
      freeSpinsTriggered: false,
      scatterCount: 0
    };

    // Check for Scatters anywhere on the 3x5 grid
    let scatterCount = 0;
    const scatterIndices: {r: number, c: number}[] = [];
    currentReels.forEach((reel, rIdx) => {
      reel.forEach((symbol, sIdx) => {
        if (symbol.id === 'scatter') {
          scatterCount++;
          scatterIndices.push({r: rIdx, c: sIdx});
        }
      });
    });

    if (scatterCount >= CONFIG.FREE_SPINS_TRIGGER_COUNT) {
      bestWin.freeSpinsTriggered = true;
      bestWin.scatterCount = scatterCount;
      // Scatters also usually pay a small amount
      bestWin.amount += bet * scatterCount; 
    }

    let matchSymbolId = payline[0].id;
    let count = 1;
    let winningIndices = [0];

    for (let i = 1; i < CONFIG.REEL_COUNT; i++) {
      const currentSymbol = payline[i];
      if (matchSymbolId === 'wild') {
        if (currentSymbol.id !== 'wild' && currentSymbol.id !== 'scatter') {
          matchSymbolId = currentSymbol.id;
        }
        if (currentSymbol.id !== 'scatter') {
          count++;
          winningIndices.push(i);
        } else {
          break;
        }
      } else if (currentSymbol.id === matchSymbolId || currentSymbol.id === 'wild') {
        if (currentSymbol.id !== 'scatter') {
          count++;
          winningIndices.push(i);
        } else {
          break;
        }
      } else {
        break;
      }
    }

    if (count >= 3 && matchSymbolId !== 'scatter') {
      let actualSymbol = payline[0];
      if (actualSymbol.id === 'wild') {
        for (let i = 1; i < count; i++) {
          if (payline[i].id !== 'wild') {
            actualSymbol = payline[i];
            break;
          }
        }
      }

      const payoutMultiplier = PAYOUTS[count] || 0;
      let winAmount = actualSymbol.value * payoutMultiplier * bet;
      
      if (isFreeSpinMode) {
        winAmount *= CONFIG.FREE_SPINS_MULTIPLIER;
      }

      bestWin.amount += winAmount;
      bestWin.symbol = actualSymbol;
      bestWin.count = count;
      bestWin.winningIndices = winningIndices;

      if (winAmount < bet) bestWin.type = 'LDW';
      else if (winAmount < bet * 3) bestWin.type = 'SMALL';
      else if (winAmount < bet * 10) bestWin.type = 'BIG';
      else bestWin.type = 'MEGA';
    }

    return bestWin;
  }, [bet, isFreeSpinMode]);

  const spin = useCallback(async () => {
    if (isSpinningRef.current || (credits < bet && !isFreeSpinMode)) return;

    isSpinningRef.current = true;
    sounds.playSpinStart();
    setIsSpinning(true);
    setSpinningReels([true, true, true, true, true]);
    
    if (!isFreeSpinMode) {
      setCredits(prev => prev - bet);
    } else {
      setFreeSpinsRemaining(prev => prev - 1);
    }

    setWin(null);
    setWinningIndices([]);
    setSuspenseActive(false);

    // Generate outcome
    let result = Array(CONFIG.REEL_COUNT).fill(0).map(() => 
      Array(CONFIG.ROW_COUNT).fill(0).map(() => getRandomSymbol())
    );

    // Near Miss Logic (only if not a natural win)
    const initialWin = calculateWin(result);
    if (initialWin.amount === 0 && Math.random() < CONFIG.NEAR_MISS_RATE) {
      const possibleTargets = SYMBOLS.slice(2, 6); // Avoid wild/scatter for near miss
      const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
      result[0][1] = target;
      result[1][1] = target;
      const neighbors = [0, 2];
      result[2][neighbors[Math.floor(Math.random() * 2)]] = target;
      let failSymbol = getRandomSymbol();
      while (failSymbol.id === target.id || failSymbol.id === 'wild' || failSymbol.id === 'scatter') {
        failSymbol = getRandomSymbol();
      }
      result[2][1] = failSymbol;
    }

    // Suspense Detection (High value symbols or Scatters)
    const s0 = result[0][1].id;
    const s1 = result[1][1].id;
    const highValueIds = ['wild', 'diamond', 'seven', 'scatter'];
    const isSuspense = (s0 === s1 || s0 === 'wild' || s1 === 'wild' || s0 === 'scatter' || s1 === 'scatter') && 
                      (highValueIds.includes(s0) || highValueIds.includes(s1));

    // Animate Reels
    const stopReel = (idx: number, finalSymbols: any[]) => {
      const fullReel = generateFullReel(finalSymbols);
      setSpinningReels(prev => {
        const next = [...prev];
        next[idx] = false;
        return next;
      });
      setReels(prev => {
        const next = [...prev];
        next[idx] = fullReel;
        return next;
      });
      sounds.playReelStop(idx);
    };

    // Schedule stops
    setTimeout(() => stopReel(0, result[0]), CONFIG.SPIN_DURATION);
    setTimeout(() => stopReel(1, result[1]), CONFIG.SPIN_DURATION + CONFIG.REEL_DELAY);
    
    const reel3Delay = isSuspense ? 4500 : CONFIG.SPIN_DURATION + (CONFIG.REEL_DELAY * 2);
    
    if (isSuspense) {
      setTimeout(() => {
        setSuspenseActive(true);
        sounds.playNearMiss();
      }, CONFIG.SPIN_DURATION + CONFIG.REEL_DELAY);
    }

    setTimeout(() => {
      stopReel(2, result[2]);
      setSuspenseActive(false);
    }, reel3Delay);
    
    setTimeout(() => stopReel(3, result[3]), reel3Delay + CONFIG.REEL_DELAY);
    setTimeout(() => {
      stopReel(4, result[4]);
      
      // Finalize
      const finalWin = calculateWin(result);
      
      setTimeout(() => {
        if (finalWin.amount > 0 || finalWin.freeSpinsTriggered) {
          setWin(finalWin);
          setWinningIndices(finalWin.winningIndices);
          setCredits(prev => prev + finalWin.amount);
          
          if (isFreeSpinMode) {
            setTotalFreeSpinWin(prev => prev + finalWin.amount);
          }

          if (finalWin.freeSpinsTriggered) {
            setFreeSpinsRemaining(prev => prev + CONFIG.FREE_SPINS_REWARD);
            if (!isFreeSpinMode) {
              setShowFreeSpinsIntro(true);
              setTotalFreeSpinWin(0);
            }
            sounds.playMegaWin(); // Special sound for trigger
          } else {
            if (finalWin.type === 'LDW') sounds.playLDW();
            else if (finalWin.type === 'MEGA') sounds.playMegaWin();
            else if (finalWin.type === 'BIG') sounds.playBigWin();
            else if (finalWin.amount > 0) sounds.playSmallWin();
          }
        }

        // Check if free spins ended
        if (isFreeSpinMode && freeSpinsRemaining === 1 && !finalWin.freeSpinsTriggered) {
          setTimeout(() => setShowFreeSpinsOutro(true), 2000);
        }

        setIsSpinning(false);
        isSpinningRef.current = false;

        // Auto-spin logic for free spins
        if (isFreeSpinMode && freeSpinsRemaining > 1 && !finalWin.freeSpinsTriggered) {
           // Small delay before next auto-spin
           setTimeout(() => {
             if (freeSpinsRemaining > 0) {
               // Optional: auto-spin trigger could go here
             }
           }, 1500);
        }
      }, 500);
    }, reel3Delay + (CONFIG.REEL_DELAY * 2));

  }, [credits, bet, calculateWin, isFreeSpinMode, freeSpinsRemaining]);

  const renderSymbol = (symbol: any, isWinning: boolean) => {
    const isPremium = symbol.premium;
    
    if (symbol.id.startsWith('bar')) {
      const count = parseInt(symbol.id.replace('bar', ''));
      return (
        <div className={`symbol-inner ${isWinning ? 'winning-symbol' : ''}`}>
          <div className="bar-stack">
            {Array(count).fill(0).map((_, i) => <div key={i} className="bar-unit"></div>)}
          </div>
        </div>
      );
    }

    if (symbol.id === 'seven') {
      return (
        <div className={`symbol-inner ${isWinning ? 'winning-symbol' : ''}`}>
          <span className="font-headline font-black text-4xl sm:text-5xl italic text-[#ff4444] drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]" style={{ transform: 'skewX(-10deg)' }}>7</span>
        </div>
      );
    }

    if (symbol.id === 'cherry') {
      return (
        <div className={`symbol-inner ${isWinning ? 'winning-symbol' : ''}`}>
          <div className="relative">
            <div className="w-6 h-6 bg-[#ff4444] rounded-full shadow-lg"></div>
            <div className="absolute -top-2 left-3 w-4 h-4 border-t-2 border-l-2 border-[#4caf50] rounded-tl-full"></div>
          </div>
        </div>
      );
    }

    return (
      <div className={`symbol-inner ${isPremium ? 'symbol-premium' : ''} ${isWinning ? 'winning-symbol' : ''}`}>
        <span className="material-symbols-outlined text-4xl sm:text-5xl" style={{ color: isPremium ? 'inherit' : symbol.color, fontVariationSettings: "'FILL' 1" }}>
          {symbol.icon}
        </span>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${isFreeSpinMode ? 'bg-[#1a0000]' : 'bg-[#001806]'} text-white font-sans overflow-hidden select-none flex flex-col transition-colors duration-1000`}>
      {/* Loading Screen */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-[#001806] flex flex-col items-center justify-center felt-texture"
          >
            <motion.div animate={{ y: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="mb-8">
              <span className="material-symbols-outlined text-8xl text-[#f2ca50]" style={{ fontVariationSettings: "'FILL' 1" }}>trophy</span>
            </motion.div>
            <h1 className="font-headline text-4xl font-black italic text-[#f2ca50] tracking-widest mb-4">THE GILDED SALON</h1>
            <div className="w-48 h-1 bg-[#0b3d1b] rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 2 }}
                className="h-full bg-[#f2ca50]"
              />
            </div>
            <p className="mt-4 font-label text-[10px] uppercase tracking-[0.3em] text-[#f2ca50]/60">Preparing your private table...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar */}
      <header style={{ height: 'var(--header-h)' }} className="fixed top-0 w-full z-50 bar-bg border-b flex items-center justify-between px-4 sm:px-8 shadow-2xl">
        <div className="flex items-center gap-2 pill-container px-3 header-item rounded-full">
          <span className="material-symbols-outlined text-[#f2ca50] icon-scale" style={{ fontVariationSettings: "'FILL' 1" }}>monetization_on</span>
          <span className="font-headline font-bold tracking-tight text-[#f2ca50] header-item flex items-center">
            ${credits.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2 header-item">
          <button 
            onClick={() => {
              const muted = sounds.toggleMute();
              setIsMuted(muted);
            }}
            className="aspect-square h-10 rounded-full bg-[#0b3d1b] border border-[#f2ca50]/30 flex items-center justify-center text-[#f2ca50] hover:bg-[#11421f] shadow-xl transition-all"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button 
            onClick={() => setShowPaytable(true)}
            className="aspect-square h-10 rounded-full bg-[#0b3d1b] border border-[#f2ca50]/30 flex items-center justify-center text-[#f2ca50] hover:bg-[#11421f] shadow-xl transition-all"
          >
            <Info size={20} />
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main style={{ paddingTop: 'var(--header-h)', paddingBottom: 'var(--footer-h)' }} className="flex-1 flex flex-col items-center justify-center p-4 relative">
        {isFreeSpinMode && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute top-[var(--header-h)] mt-4 z-30 bg-[#f2ca50] text-[#001806] px-6 py-1 rounded-full font-headline font-black italic tracking-widest shadow-[0_0_20px_rgba(242,202,80,0.5)]"
          >
            FREE SPINS MODE - {CONFIG.FREE_SPINS_MULTIPLIER}X MULTIPLIER
          </motion.div>
        )}

        <div className={`slot-machine-container relative w-full max-w-2xl ${isFreeSpinMode ? 'bg-[#120000] border-[#f2ca50]' : 'bg-[#001204] border-[#4d4635]/40'} rounded-xl p-3 border-4 shadow-2xl overflow-hidden ${suspenseActive ? 'suspense-active' : ''}`}>
          <div className="payline-indicator"></div>
          
          <div className="grid grid-cols-5 gap-1 relative" style={{ height: 'calc(var(--symbol-h) * 3)' }}>
            {reels.map((reel, rIdx) => (
              <div key={rIdx} className={`reel-container h-full relative flex flex-col ${suspenseActive && rIdx !== 2 ? 'suspense-reel-dim' : ''}`}>
                <motion.div 
                  className={`reel-strip absolute w-full ${spinningReels[rIdx] ? 'blur-[1px]' : ''}`}
                  animate={spinningReels[rIdx] ? { y: ["0%", "-80%"] } : { y: "0%" }}
                  transition={spinningReels[rIdx] ? { 
                    repeat: Infinity, 
                    duration: (suspenseActive && rIdx === 2) ? 1.5 : 0.8, 
                    ease: "linear" 
                  } : { type: "spring", stiffness: 200, damping: 25 }}
                >
                  {reel.map((symbol, sIdx) => (
                    <div key={sIdx} className="symbol">
                      {renderSymbol(symbol, winningIndices.includes(rIdx) && sIdx === 1)}
                    </div>
                  ))}
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Bar */}
      <footer style={{ height: 'var(--footer-h)' }} className="fixed bottom-0 w-full z-40 bar-bg border-t flex items-center justify-between px-4 sm:px-8 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3 footer-item">
          <div className="pill-container flex items-center gap-2 sm:gap-4 px-2 h-[92%] rounded-full py-1">
            <button 
              onClick={() => {
                setBetIndex(prev => (prev - 1 + CONFIG.BET_OPTIONS.length) % CONFIG.BET_OPTIONS.length);
                sounds.playTone(330, 'sine', 0.05, 0.05);
              }}
              disabled={isSpinning}
              className="bet-btn aspect-square h-8 rounded-full bg-[#0b3d1b] text-[#f2ca50] border border-[#f2ca50]/40 flex items-center justify-center hover:bg-[#11421f] transition-all shadow-lg active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minus size={16} />
            </button>
            <div className="flex flex-col items-center px-2">
              <span className="font-label text-[8px] sm:text-[10px] uppercase tracking-tighter text-[#f2ca50]/50 leading-none mb-0.5">Bet</span>
              <span className="font-headline font-bold text-[#f2ca50] min-w-[2.5em] sm:min-w-[3.5em] text-center leading-none">${bet}</span>
            </div>
            <button 
              onClick={() => {
                setBetIndex(prev => (prev + 1) % CONFIG.BET_OPTIONS.length);
                sounds.playTone(440, 'sine', 0.05, 0.05);
              }}
              disabled={isSpinning}
              className="bet-btn aspect-square h-8 rounded-full bg-[#0b3d1b] text-[#f2ca50] border border-[#f2ca50]/40 flex items-center justify-center hover:bg-[#11421f] transition-all shadow-lg active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <button 
            onClick={() => {
              setBetIndex(CONFIG.BET_OPTIONS.length - 1);
              sounds.playTone(880, 'sine', 0.1, 0.1);
            }}
            disabled={isSpinning}
            className="flex flex-col items-center justify-center h-[92%] px-4 rounded-xl bg-gradient-to-b from-[#f2ca50] to-[#d4af37] text-[#001806] hover:brightness-110 transition-all max-bet-glow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:brightness-75"
          >
            <span className="font-label font-black text-xs uppercase tracking-tighter">MAX</span>
            <span className="font-label font-black text-[10px] uppercase -mt-1">BET</span>
          </button>
        </div>

        <div className="flex flex-col items-center footer-item flex-1 max-w-[140px] sm:max-w-xs mx-2 sm:mx-4 justify-center">
          <div className="w-full h-[92%] rounded-xl win-display-box flex flex-col items-center justify-center border-2 px-4 py-1">
            <span className="font-label text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-[#f2ca50]/70 mb-0.5">Win Amount</span>
            <span className="font-headline font-black text-[#f2ca50] text-xl tracking-tight leading-none">${win ? win.amount.toLocaleString() : '0'}</span>
          </div>
        </div>

        <div className="w-20 sm:w-32"></div>
      </footer>

      {/* Spin Button */}
      <div className="fixed bottom-4 right-4 z-50">
        <button 
          onClick={spin}
          disabled={isSpinning || (credits < bet && !isFreeSpinMode)}
          className={`spin-button-outer ${isFreeSpinMode ? 'free-spin-glow' : ''}`} 
          style={{ width: 'var(--spin-size)', height: 'var(--spin-size)', opacity: (isSpinning || (credits < bet && !isFreeSpinMode)) ? 0.5 : 1 }}
        >
          <div className="spin-button-inner w-full h-full flex items-center justify-center">
            {isSpinning ? (
              <RotateCw className="animate-spin text-[#f2ca50]" size={40} />
            ) : isFreeSpinMode ? (
              <div className="flex flex-col items-center">
                <span className="font-headline font-black text-[#f2ca50] uppercase tracking-tighter" style={{ fontSize: 'calc(var(--spin-size) * 0.25)' }}>{freeSpinsRemaining}</span>
                <span className="font-headline font-black text-[#f2ca50] uppercase tracking-widest" style={{ fontSize: 'calc(var(--spin-size) * 0.1)' }}>FREE</span>
              </div>
            ) : (
              <span className="font-headline font-black text-[#f2ca50] uppercase tracking-[0.2em]" style={{ fontSize: 'calc(var(--spin-size) * 0.22)' }}>SPIN</span>
            )}
          </div>
        </button>
      </div>

      {/* Win Overlay */}
      <AnimatePresence>
        {win && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setWin(null)}
            className="win-overlay fixed inset-0 z-[150] cursor-pointer w-full h-full bg-black/80 flex items-center justify-center"
          >
            <div className="win-content flex flex-col items-center justify-center w-full h-full px-4">
              <motion.div 
                initial={{ scale: 0.5, rotate: -10 }}
                animate={{ scale: 1, rotate: -2 }}
                className="text-center pointer-events-none w-full max-w-4xl"
              >
                <h2 className="font-headline font-black italic text-6xl md:text-8xl text-[#f2ca50] drop-shadow-[0_0_30px_rgba(242,202,80,0.8)] tracking-tighter uppercase">
                  {win.type === 'MEGA' ? 'MEGA WIN!' : win.type === 'BIG' ? 'BIG WIN!' : 'WINNER!'}
                </h2>
                <div className="mt-4 inline-block bg-[#f89c64] text-[#321200] px-8 py-3 font-label font-bold text-2xl rounded-sm shadow-xl border border-[#f2ca50]/30 min-w-[200px]">
                  +${win.amount.toLocaleString()}
                </div>
              </motion.div>
              <div className="mt-12 text-[#f2ca50] font-label font-bold tracking-widest uppercase border-b border-[#f2ca50] animate-pulse">Tap anywhere to continue</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Free Spins Intro Modal */}
      <AnimatePresence>
        {showFreeSpinsIntro && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] bg-black/90 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0b3d1b] border-4 border-[#f2ca50] p-8 rounded-3xl text-center max-w-md shadow-[0_0_50px_rgba(242,202,80,0.4)]"
            >
              <div className="mb-6">
                <span className="material-symbols-outlined text-8xl text-[#f2ca50] animate-bounce" style={{ fontVariationSettings: "'FILL' 1" }}>vpn_key</span>
              </div>
              <h2 className="font-headline text-5xl font-black italic text-[#f2ca50] mb-4 tracking-tighter">FREE SPINS!</h2>
              <p className="text-white text-xl font-bold mb-8">
                YOU'VE UNLOCKED <span className="text-[#f2ca50] text-3xl">{CONFIG.FREE_SPINS_REWARD}</span> FREE SPINS<br/>
                WITH A <span className="text-[#f2ca50] text-3xl">{CONFIG.FREE_SPINS_MULTIPLIER}X</span> MULTIPLIER!
              </p>
              <button 
                onClick={() => setShowFreeSpinsIntro(false)}
                className="w-full py-4 bg-[#f2ca50] text-[#001806] font-headline font-black text-2xl rounded-xl hover:brightness-110 transition-all shadow-xl"
              >
                START BONUS
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Free Spins Outro Modal */}
      <AnimatePresence>
        {showFreeSpinsOutro && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] bg-black/90 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0b3d1b] border-4 border-[#f2ca50] p-8 rounded-3xl text-center max-w-md shadow-[0_0_50px_rgba(242,202,80,0.4)]"
            >
              <h2 className="font-headline text-4xl font-black italic text-[#f2ca50] mb-2 tracking-tighter">BONUS COMPLETE</h2>
              <p className="text-white/60 text-sm uppercase tracking-widest mb-6">Total Feature Win</p>
              <div className="text-6xl font-headline font-black text-[#f2ca50] mb-10 drop-shadow-lg">
                ${totalFreeSpinWin.toLocaleString()}
              </div>
              <button 
                onClick={() => setShowFreeSpinsOutro(false)}
                className="w-full py-4 bg-[#f2ca50] text-[#001806] font-headline font-black text-2xl rounded-xl hover:brightness-110 transition-all shadow-xl"
              >
                COLLECT
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paytable Modal */}
      <AnimatePresence>
        {showPaytable && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="paytable-modal fixed inset-0 z-[210] bg-[#001806] p-4 sm:p-8 overflow-y-auto"
          >
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-6 sm:mb-8">
                <h2 className="font-headline text-3xl sm:text-4xl font-black italic text-[#f2ca50]">PAY TABLE</h2>
                <button onClick={() => setShowPaytable(false)} className="text-[#f2ca50]"><X size={32} /></button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {SYMBOLS.map(s => (
                  <div key={s.id} className="flex items-center gap-3 sm:gap-4 bg-[#0b3d1b] p-3 sm:p-4 rounded-xl border-l-4 border-[#f2ca50] shadow-lg">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 bg-[#001204] border border-[#f2ca50]/40 rounded-lg flex items-center justify-center overflow-hidden">
                      {renderSymbol(s, false)}
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div className="text-center"><span className="block text-[10px] font-label text-[#d0c5af]">5X</span><span className="font-headline font-bold text-[#f2ca50]">{s.value * PAYOUTS[5]}</span></div>
                      <div className="text-center"><span className="block text-[10px] font-label text-[#d0c5af]">4X</span><span className="font-headline font-bold text-white">{s.value * PAYOUTS[4]}</span></div>
                      <div className="text-center"><span className="block text-[10px] font-label text-[#d0c5af]">3X</span><span className="font-headline font-bold text-white">{s.value * PAYOUTS[3]}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-12 p-6 bg-[#0b3d1b] rounded-xl text-center border border-[#f2ca50]/10">
                <h4 className="font-headline text-lg text-[#f2ca50] mb-2 italic">House Rules</h4>
                <p className="text-[#baf0be] text-sm">
                  Only the highest win paid per line. Wins are calculated on the middle payline. 
                  Wild substitutes for all symbols. RTP: ~92%.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
