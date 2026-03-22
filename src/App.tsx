/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Coins, 
  Info, 
  RefreshCw, 
  Minus, 
  Plus, 
  Trophy, 
  Star, 
  History, 
  Menu,
  X,
  ChevronRight
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
  SYMBOL_HEIGHT: 100,
  SPIN_DURATION: 2000,
  REEL_DELAY: 200,
  SUSPENSE_REEL: 2, // Index of reel to slow down (3rd reel)
};

const SYMBOLS = [
  { id: 'wild', name: 'Golden Star', icon: Star, value: 50, weight: 2, color: '#f2ca50' },
  { id: 'diamond', name: 'Diamond', icon: Trophy, value: 25, weight: 5, color: '#baf0be' },
  { id: 'seven', name: 'Lucky 7', icon: () => <span className="font-black italic text-red-500">7</span>, value: 15, weight: 8, color: '#ffb4ab' },
  { id: 'bell', name: 'Bell', icon: () => <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>notifications</span>, value: 10, weight: 12, color: '#fbbc00' },
  { id: 'bar3', name: 'Triple Bar', icon: () => <div className="flex flex-col gap-0.5"><div className="w-10 h-1.5 bg-gray-400 rounded-full"></div><div className="w-10 h-1.5 bg-gray-400 rounded-full"></div><div className="w-10 h-1.5 bg-gray-400 rounded-full"></div></div>, value: 5, weight: 15, color: '#99907c' },
  { id: 'bar2', name: 'Double Bar', icon: () => <div className="flex flex-col gap-0.5"><div className="w-10 h-1.5 bg-gray-400 rounded-full"></div><div className="w-10 h-1.5 bg-gray-400 rounded-full"></div></div>, value: 3, weight: 20, color: '#99907c' },
  { id: 'bar1', name: 'Single Bar', icon: () => <div className="w-10 h-1.5 bg-gray-400 rounded-full"></div>, value: 2, weight: 25, color: '#99907c' },
  { id: 'cherry', name: 'Cherry', icon: () => <span className="material-symbols-outlined text-red-500">nutrition</span>, value: 1, weight: 35, color: '#ff4444' }
];

const PAYOUTS = {
  3: 1,
  4: 5,
  5: 20
};

export default function App() {
  const [credits, setCredits] = useState(CONFIG.STARTING_CREDITS);
  const [betIndex, setBetIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [reels, setReels] = useState<any[][]>([]);
  const [win, setWin] = useState<any>(null);
  const [showPaytable, setShowPaytable] = useState(false);
  const [stats, setStats] = useState({ spins: 0, totalWon: 0, biggestWin: 0 });
  const [nearMissReel, setNearMissReel] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const bet = CONFIG.BET_OPTIONS[betIndex];

  // Initialize reels and loading state
  useEffect(() => {
    const initialReels = Array(CONFIG.REEL_COUNT).fill(0).map(() => 
      Array(CONFIG.ROW_COUNT).fill(0).map(() => getRandomSymbol())
    );
    setReels(initialReels);

    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 2000);
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

  const calculateWin = (currentReels: any[][]) => {
    const payline = currentReels.map(reel => reel[1]); // Middle row
    let bestWin = { amount: 0, type: 'NONE', symbol: null, count: 0 };

    const firstSymbol = payline[0];
    let count = 1;
    for (let i = 1; i < CONFIG.REEL_COUNT; i++) {
      if (payline[i].id === firstSymbol.id || payline[i].id === 'wild' || firstSymbol.id === 'wild') {
        count++;
      } else {
        break;
      }
    }

    if (count >= 3) {
      let actualSymbol = firstSymbol;
      if (firstSymbol.id === 'wild') {
        for (let i = 1; i < count; i++) {
          if (payline[i].id !== 'wild') {
            actualSymbol = payline[i];
            break;
          }
        }
      }

      const multiplier = PAYOUTS[count as keyof typeof PAYOUTS] || 0;
      const winAmount = actualSymbol.value * multiplier * bet;
      
      bestWin = {
        amount: winAmount,
        symbol: actualSymbol,
        count: count,
        type: 'NONE'
      };

      if (winAmount < bet) bestWin.type = 'LDW';
      else if (winAmount < bet * 3) bestWin.type = 'SMALL';
      else if (winAmount < bet * 10) bestWin.type = 'BIG';
      else bestWin.type = 'MEGA';
    }

    return bestWin;
  };

  const [spinningReels, setSpinningReels] = useState<boolean[]>([false, false, false, false, false]);

  const spin = useCallback(() => {
    if (isSpinning || credits < bet) return;

    setIsSpinning(true);
    setSpinningReels([true, true, true, true, true]);
    setCredits(prev => prev - bet);
    setWin(null);
    setNearMissReel(null);
    setStats(prev => ({ ...prev, spins: prev.spins + 1 }));

    // Generate outcome
    let result = Array(CONFIG.REEL_COUNT).fill(0).map(() => 
      Array(CONFIG.ROW_COUNT).fill(0).map(() => getRandomSymbol())
    );

    const initialWin = calculateWin(result);
    
    // Near Miss Logic
    let isNearMiss = false;
    if (initialWin.amount === 0 && Math.random() < CONFIG.NEAR_MISS_RATE) {
      const highSymbols = SYMBOLS.slice(0, 3);
      const target = highSymbols[Math.floor(Math.random() * highSymbols.length)];
      result[0][1] = target;
      result[1][1] = target;
      const neighbors = [0, 2];
      const missPos = neighbors[Math.floor(Math.random() * 2)];
      result[2][missPos] = target;
      result[2][1] = getRandomSymbol();
      while(result[2][1].id === target.id) result[2][1] = getRandomSymbol();
      isNearMiss = true;
    }

    // Check for suspense (reels 1-2 match)
    const isSuspense = result[0][1].id === result[1][1].id || result[0][1].id === 'wild' || result[1][1].id === 'wild';

    // Stop reels one by one
    const stopReel = (idx: number) => {
      setSpinningReels(prev => {
        const next = [...prev];
        next[idx] = false;
        return next;
      });
      
      const newReels = [...reels];
      newReels[idx] = result[idx];
      setReels([...newReels]);

      if (idx === CONFIG.REEL_COUNT - 1) {
        const finalWin = calculateWin(result);
        if (finalWin.amount > 0) {
          setWin(finalWin);
          setCredits(prev => prev + finalWin.amount);
          setStats(prev => ({
            ...prev,
            totalWon: prev.totalWon + finalWin.amount,
            biggestWin: Math.max(prev.biggestWin, finalWin.amount)
          }));
        }
        if (isNearMiss) setNearMissReel(2);
        setIsSpinning(false);
      }
    };

    // Schedule stops
    setTimeout(() => stopReel(0), 1000);
    setTimeout(() => stopReel(1), 1400);
    
    // Reel 3 Suspense
    const reel3Delay = isSuspense ? 3000 : 1800;
    setTimeout(() => stopReel(2), reel3Delay);
    
    setTimeout(() => stopReel(3), reel3Delay + 400);
    setTimeout(() => stopReel(4), reel3Delay + 800);

  }, [isSpinning, credits, bet, reels]);

  return (
    <div className="flex flex-col h-screen bg-[#001806] text-[#baf0be] font-body overflow-hidden select-none">
      {/* Loading Screen */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-[#001806] flex flex-col items-center justify-center felt-texture"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="mb-8"
            >
              <Trophy className="w-24 h-24 text-[#f2ca50]" fill="currentColor" />
            </motion.div>
            <h1 className="font-headline text-4xl font-black italic text-[#f2ca50] tracking-widest mb-4">THE GILDED SALON</h1>
            <div className="w-48 h-1 bg-[#0b3d1b] rounded-full overflow-hidden">
              <motion.div 
                initial={{ x: "-100%" }}
                animate={{ x: "0%" }}
                transition={{ duration: 2 }}
                className="w-full h-full bg-[#f2ca50]"
              />
            </div>
            <p className="mt-4 font-label text-[10px] uppercase tracking-[0.3em] text-[#f2ca50]/60">Preparing your private table...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar */}
      <nav className="flex justify-between items-center px-6 h-16 bg-[#0b3d1b]/80 backdrop-blur-md border-b border-[#4d4635]/20 shadow-xl z-50">
        <div className="flex items-center gap-2">
          <Coins className="text-[#f2ca50] w-5 h-5" fill="currentColor" />
          <span className="font-headline font-bold text-xl tracking-tight text-[#f2ca50]">
            ${credits.toLocaleString()}
          </span>
        </div>
        <div className="text-[#f2ca50] font-headline font-black italic text-lg tracking-tight">THE GILDED SALON</div>
        <button onClick={() => setShowPaytable(true)} className="text-[#d0c5af] hover:text-[#ffe088] transition-colors">
          <Info className="w-6 h-6" />
        </button>
      </nav>

      {/* Main Game Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative bg-[#0b3d1b] felt-texture">
        {/* Slot Machine Frame */}
        <div className="relative w-full max-w-4xl bg-[#001204] rounded-xl p-3 border-4 border-[#4d4635]/40 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden">
          {/* Payline Indicator */}
          <div className="absolute inset-x-0 top-1/2 h-[2px] bg-gradient-to-r from-transparent via-[#f2ca50] to-transparent -translate-y-1/2 z-20 opacity-40 pointer-events-none"></div>
          
          {/* Reels Grid */}
          <div className="grid grid-cols-5 gap-1 h-[300px] relative">
            {reels.map((reel, rIdx) => (
              <div key={rIdx} className="relative bg-[#11421f]/20 shadow-inner flex flex-col justify-around items-center border-x border-[#4d4635]/10 overflow-hidden">
                <motion.div
                  animate={spinningReels[rIdx] ? {
                    y: [0, -1000],
                    transition: { 
                      duration: rIdx === 2 && spinningReels[0] === false && spinningReels[1] === false && (reels[0][1].id === reels[1][1].id) ? 0.5 : 0.1, 
                      repeat: Infinity, 
                      ease: "linear"
                    }
                  } : { y: 0 }}
                  className="flex flex-col gap-4"
                >
                  {reel.map((symbol, sIdx) => (
                    <div 
                      key={sIdx} 
                      className={`h-[100px] flex items-center justify-center text-5xl transition-all duration-500 ${
                        nearMissReel === rIdx && sIdx !== 1 && symbol.id === reels[0][1].id ? 'near-miss-glow rounded-lg' : ''
                      }`}
                    >
                      {typeof symbol.icon === 'function' ? <symbol.icon /> : <symbol.icon className="w-12 h-12" style={{ color: symbol.color }} />}
                    </div>
                  ))}
                </motion.div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-8 w-full max-w-2xl flex items-center justify-between gap-4 z-30">
          <div className="flex flex-col items-center">
            <span className="font-label text-[10px] uppercase tracking-widest text-[#d0c5af] mb-1">Total Bet</span>
            <div className="bg-[#001204] px-4 py-2 rounded-sm border-b border-[#4d4635] flex items-center gap-3">
              <button 
                onClick={() => setBetIndex(prev => (prev - 1 + CONFIG.BET_OPTIONS.length) % CONFIG.BET_OPTIONS.length)}
                disabled={isSpinning}
                className="w-8 h-8 rounded-sm bg-[#0b3d1b] text-[#f2ca50] border border-[#4d4635]/30 flex items-center justify-center hover:bg-[#11421f] disabled:opacity-50"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-headline font-bold text-2xl text-[#f2ca50] w-12 text-center">${bet}</span>
              <button 
                onClick={() => setBetIndex(prev => (prev + 1) % CONFIG.BET_OPTIONS.length)}
                disabled={isSpinning}
                className="w-8 h-8 rounded-sm bg-[#0b3d1b] text-[#f2ca50] border border-[#4d4635]/30 flex items-center justify-center hover:bg-[#11421f] disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={spin}
              disabled={isSpinning || credits < bet}
              className={`relative w-24 h-24 rounded-full border-[6px] border-[#d4af37] bg-[#0b3d1b] flex items-center justify-center shadow-2xl transition-all duration-150 group ${
                isSpinning ? 'opacity-50' : 'hover:bg-[#11421f]'
              }`}
            >
              <RefreshCw className={`w-12 h-12 text-[#f2ca50] ${isSpinning ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
            </motion.button>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-label text-[10px] font-bold text-[#f2ca50] uppercase tracking-[0.2em]">Spin</div>
          </div>

          <div className="flex flex-col items-center">
            <span className="font-label text-[10px] uppercase tracking-widest text-[#d0c5af] mb-1">Stats</span>
            <button className="bg-[#001204] px-6 py-3 rounded-sm border border-[#f2ca50]/40 text-[#f2ca50] font-label font-bold tracking-widest uppercase hover:bg-[#f2ca50] hover:text-[#3c2f00] transition-all">
              {stats.spins}
            </button>
          </div>
        </div>
      </main>

      {/* Win Overlay */}
      <AnimatePresence>
        {win && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setWin(null)}
            className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer"
          >
            <motion.div 
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: -2 }}
              className="text-center pointer-events-none"
            >
              <h2 className={`font-headline font-black italic tracking-tighter uppercase drop-shadow-[0_0_30px_rgba(242,202,80,0.8)] ${
                win.type === 'MEGA' ? 'text-8xl text-yellow-400 animate-bounce' : 
                win.type === 'BIG' ? 'text-7xl text-yellow-500' : 'text-6xl text-primary'
              }`}>
                {win.type === 'MEGA' ? 'MEGA WIN!' : win.type === 'BIG' ? 'BIG WIN!' : 'WIN!'}
              </h2>
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-4 inline-block bg-[#f89c64] text-[#321200] px-8 py-3 font-label font-bold text-2xl rounded-sm shadow-xl border border-[#f2ca50]/30"
              >
                +${win.amount.toLocaleString()}
              </motion.div>
            </motion.div>
            <div className="mt-12 text-[#f2ca50] font-label font-bold tracking-widest uppercase border-b border-[#f2ca50] animate-pulse">
              Tap anywhere to continue
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paytable Modal */}
      <div className={`fixed inset-0 z-[110] bg-[#001806] p-8 overflow-y-auto transition-transform duration-300 ${showPaytable ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-headline text-4xl font-black italic text-[#f2ca50]">PAY TABLE</h2>
            <button onClick={() => setShowPaytable(false)} className="text-[#f2ca50]">
              <X className="w-10 h-10" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {SYMBOLS.map(s => (
              <div key={s.id} className="flex items-center gap-4 bg-[#0b3d1b] p-4 rounded-xl border-l-4 border-[#f2ca50] shadow-lg">
                <div className="w-16 h-16 flex-shrink-0 bg-[#001204] border border-[#f2ca50]/40 rounded-lg flex items-center justify-center text-3xl">
                  {typeof s.icon === 'function' ? <s.icon /> : <s.icon className="w-8 h-8" style={{ color: s.color }} />}
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
      </div>

      {/* Bottom Navigation */}
      <nav className="flex justify-around items-center px-4 pb-4 pt-2 bg-[#001204] rounded-t-lg shadow-2xl z-50">
        <button className="flex flex-col items-center justify-center bg-gradient-to-b from-[#ffe088] to-[#d4af37] text-[#001204] rounded-xl px-6 py-2 shadow-lg">
          <Menu className="w-5 h-5" />
          <span className="font-label font-semibold uppercase tracking-widest text-[10px]">PLAY</span>
        </button>
        <button className="flex flex-col items-center justify-center text-[#d0c5af]/60 px-6 py-2 hover:text-[#f2ca50]">
          <History className="w-5 h-5" />
          <span className="font-label font-semibold uppercase tracking-widest text-[10px]">HISTORY</span>
        </button>
        <button className="flex flex-col items-center justify-center text-[#d0c5af]/60 px-6 py-2 hover:text-[#f2ca50]">
          <Trophy className="w-5 h-5" />
          <span className="font-label font-semibold uppercase tracking-widest text-[10px]">STATS</span>
        </button>
      </nav>

      <style>{`
        .felt-texture {
          background-image: radial-gradient(#0d4a21 0.5px, transparent 0.5px);
          background-size: 4px 4px;
        }
        .near-miss-glow {
          box-shadow: 0 0 20px #f2ca50;
          border: 2px solid #f2ca50;
          background: rgba(242, 202, 80, 0.1);
        }
      `}</style>
    </div>
  );
}
