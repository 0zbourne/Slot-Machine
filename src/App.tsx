/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
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
  { id: 'seven', name: 'Lucky 7', icon: () => <span className="font-display font-black italic text-6xl text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]">7</span>, value: 15, weight: 8, color: '#ffb4ab' },
  { id: 'bell', name: 'Bell', icon: () => <span className="material-symbols-outlined text-6xl" style={{fontVariationSettings: "'FILL' 1"}}>notifications</span>, value: 10, weight: 12, color: '#fbbc00' },
  { id: 'bar3', name: 'Triple Bar', icon: () => <div className="flex flex-col gap-1.5"><div className="w-16 h-2.5 bg-gradient-to-r from-gray-400 to-gray-600 rounded-sm shadow-inner"></div><div className="w-16 h-2.5 bg-gradient-to-r from-gray-400 to-gray-600 rounded-sm shadow-inner"></div><div className="w-16 h-2.5 bg-gradient-to-r from-gray-400 to-gray-600 rounded-sm shadow-inner"></div></div>, value: 5, weight: 15, color: '#99907c' },
  { id: 'bar2', name: 'Double Bar', icon: () => <div className="flex flex-col gap-1.5"><div className="w-16 h-2.5 bg-gradient-to-r from-gray-400 to-gray-600 rounded-sm shadow-inner"></div><div className="w-16 h-2.5 bg-gradient-to-r from-gray-400 to-gray-600 rounded-sm shadow-inner"></div></div>, value: 3, weight: 20, color: '#99907c' },
  { id: 'bar1', name: 'Single Bar', icon: () => <div className="w-16 h-2.5 bg-gradient-to-r from-gray-400 to-gray-600 rounded-sm shadow-inner"></div>, value: 2, weight: 25, color: '#99907c' },
  { id: 'cherry', name: 'Cherry', icon: () => <span className="material-symbols-outlined text-6xl text-red-500" style={{fontVariationSettings: "'FILL' 1"}}>nutrition</span>, value: 1, weight: 35, color: '#ff4444' }
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
  const [recentWins, setRecentWins] = useState<number[]>([]);

  const bet = CONFIG.BET_OPTIONS[betIndex];

  // Initialize reels and loading state
  useEffect(() => {
    const initialReels = Array(CONFIG.REEL_COUNT).fill(0).map(() => 
      Array(CONFIG.ROW_COUNT).fill(0).map(() => getRandomSymbol())
    );
    setReels(initialReels);

    // Simulate loading
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
          setRecentWins(prev => [finalWin.amount, ...prev].slice(0, 5));
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
    <div className="flex flex-col h-screen bg-emerald-deep text-white font-sans overflow-hidden select-none">
      {/* Loading Screen */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-emerald-deep flex flex-col items-center justify-center felt-texture"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [0, 2, -2, 0]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="mb-8 relative"
            >
              <div className="absolute inset-0 blur-3xl bg-gold/30 rounded-full"></div>
              <Trophy className="w-32 h-32 text-gold-light relative z-10 glow-gold" fill="currentColor" />
            </motion.div>
            <h1 className="font-display text-7xl font-black italic text-gold-light tracking-tighter mb-2 skew-x-[-10deg]">THE GILDED SALON</h1>
            <div className="w-80 h-1 bg-emerald-felt rounded-full overflow-hidden relative border border-white/5">
              <motion.div 
                initial={{ x: "-100%" }}
                animate={{ x: "0%" }}
                transition={{ duration: 2.5, ease: "easeInOut" }}
                className="w-full h-full bg-gold-light shadow-[0_0_20px_rgba(242,202,80,0.8)]"
              />
            </div>
            <p className="mt-8 font-serif italic text-sm uppercase tracking-[0.5em] text-gold-light/30">ESTABLISHED 1924</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar - Editorial Style */}
      <nav className="flex justify-between items-end px-10 h-24 glass-panel border-b border-white/5 shadow-2xl z-50 pb-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-serif italic uppercase tracking-[0.3em] text-gold-light/40 mb-1">Current Liquidity</span>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-gold-light animate-pulse shadow-[0_0_10px_rgba(242,202,80,0.8)]"></div>
            <span className="font-mono font-bold text-3xl tracking-tighter text-gold-light neon-text">
              ${credits.toLocaleString()}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col items-center mb-1">
          <h1 className="font-display text-4xl font-black italic tracking-tighter text-gold-light skew-x-[-5deg]">GILDED</h1>
          <div className="h-[2px] w-full bg-gold/40 mt-0.5"></div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-serif italic uppercase tracking-[0.3em] text-gold-light/40 mb-1">Recent Wins</span>
            <div className="flex gap-2">
              {recentWins.length > 0 ? recentWins.map((w, i) => (
                <motion.span 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i} 
                  className="font-mono text-[10px] text-gold-light/60 bg-white/5 px-2 py-0.5 rounded"
                >
                  ${w}
                </motion.span>
              )) : <span className="font-mono text-[10px] text-white/20 italic">No activity</span>}
            </div>
          </div>
          <button 
            onClick={() => setShowPaytable(true)} 
            className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-gold-light hover:bg-white/10 transition-all border border-gold/20 shadow-lg group"
          >
            <Info className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </nav>

      {/* Main Game Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative felt-texture overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-gold/5 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gold/5 blur-[120px] rounded-full"></div>

        {/* Slot Machine Frame - Heavy Hardware Look */}
        <div className="relative w-full max-w-6xl bg-[#080808] rounded-[3rem] p-8 border-[16px] border-[#121212] shadow-[0_60px_120px_rgba(0,0,0,0.9),inset_0_2px_20px_rgba(255,255,255,0.05)] overflow-hidden leather-trim">
          {/* Decorative Screws */}
          <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-[#222] border border-white/5 shadow-inner"></div>
          <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-[#222] border border-white/5 shadow-inner"></div>
          <div className="absolute bottom-4 left-4 w-3 h-3 rounded-full bg-[#222] border border-white/5 shadow-inner"></div>
          <div className="absolute bottom-4 right-4 w-3 h-3 rounded-full bg-[#222] border border-white/5 shadow-inner"></div>

          {/* Inner Gold Bezel */}
          <div className="absolute inset-2 border-[1px] border-gold/30 rounded-[2.5rem] pointer-events-none"></div>
          
          {/* Payline Indicator - More Dramatic */}
          <div className="absolute inset-x-0 top-1/2 h-[2px] bg-gradient-to-r from-transparent via-gold-light/40 to-transparent -translate-y-1/2 z-20 pointer-events-none"></div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-12 bg-gold-light/10 blur-md z-20 rounded-full"></div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-12 bg-gold-light/10 blur-md z-20 rounded-full"></div>
          
          {/* Reels Grid */}
          <div className="grid grid-cols-5 gap-3 h-[420px] relative reel-shadow bg-[#020202] rounded-2xl overflow-hidden border border-white/5">
            {reels.map((reel, rIdx) => (
              <div key={rIdx} className="relative flex flex-col justify-around items-center border-x border-white/5 overflow-hidden group">
                {/* Reel Divider Glow */}
                <div className="absolute inset-y-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent"></div>
                
                <motion.div
                  animate={spinningReels[rIdx] ? {
                    y: [0, -1400],
                    transition: { 
                      duration: rIdx === 2 && spinningReels[0] === false && spinningReels[1] === false && (reels[0][1].id === reels[1][1].id) ? 0.35 : 0.07, 
                      repeat: Infinity, 
                      ease: "linear"
                    }
                  } : { y: 0 }}
                  className="flex flex-col gap-10"
                >
                  {reel.map((symbol, sIdx) => (
                    <div 
                      key={sIdx} 
                      className={`h-[140px] w-full flex items-center justify-center transition-all duration-500 ${
                        nearMissReel === rIdx && sIdx === 1 ? 'bg-gold/10' : ''
                      }`}
                    >
                      <div className={`transform transition-all duration-500 ${spinningReels[rIdx] ? 'blur-[4px] scale-90 opacity-60' : 'scale-125 hover:scale-135'}`}>
                        {typeof symbol.icon === 'function' ? <symbol.icon /> : <symbol.icon className="w-20 h-20 glow-gold" style={{ color: symbol.color }} />}
                      </div>
                    </div>
                  ))}
                </motion.div>
                
                {/* Reel Suspense Glow - High Impact */}
                {spinningReels[rIdx] && rIdx === 2 && !spinningReels[1] && (reels[0][1].id === reels[1][1].id) && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.4, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="absolute inset-0 bg-gold/20 pointer-events-none z-10"
                  ></motion.div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Controls - Hardware Console Style */}
        <div className="mt-16 w-full max-w-4xl flex items-center justify-between gap-12 z-30">
          {/* Bet Control - Industrial Look */}
          <div className="flex flex-col items-start">
            <span className="text-[11px] font-display italic uppercase tracking-[0.4em] text-gold-light/40 mb-3 ml-2">WAGER SELECTION</span>
            <div className="glass-panel p-1.5 rounded-[2rem] border border-white/10 flex items-center gap-6 shadow-2xl bg-black/40">
              <button 
                onClick={() => setBetIndex(prev => (prev - 1 + CONFIG.BET_OPTIONS.length) % CONFIG.BET_OPTIONS.length)}
                disabled={isSpinning}
                className="w-14 h-14 rounded-2xl bg-white/5 text-gold-light flex items-center justify-center hover:bg-white/10 disabled:opacity-10 transition-all active:scale-90 border border-white/5 shadow-lg"
              >
                <Minus className="w-5 h-5" />
              </button>
              <div className="flex flex-col items-center min-w-[100px]">
                <span className="font-mono font-black text-4xl text-gold-light tracking-tighter neon-text">${bet}</span>
                <span className="text-[8px] font-serif italic uppercase tracking-widest text-white/20">per pull</span>
              </div>
              <button 
                onClick={() => setBetIndex(prev => (prev + 1) % CONFIG.BET_OPTIONS.length)}
                disabled={isSpinning}
                className="w-14 h-14 rounded-2xl bg-white/5 text-gold-light flex items-center justify-center hover:bg-white/10 disabled:opacity-10 transition-all active:scale-90 border border-white/5 shadow-lg"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Spin Button - The Centerpiece */}
          <div className="relative group scale-110">
            <div className={`absolute -inset-8 rounded-full blur-3xl transition-all duration-700 ${isSpinning ? 'bg-red-500/30' : 'bg-gold/40 group-hover:bg-gold/60'}`}></div>
            <div className="absolute -inset-2 rounded-full border border-gold/20 animate-[spin_10s_linear_infinite]"></div>
            
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={spin}
              disabled={isSpinning || credits < bet}
              className={`relative w-36 h-36 rounded-full border-[12px] border-[#1a1a1a] flex items-center justify-center shadow-[0_25px_50px_rgba(0,0,0,0.7),inset_0_4px_10px_rgba(255,255,255,0.2)] transition-all duration-500 ${
                isSpinning ? 'bg-red-950/60' : 'metallic-gold'
              }`}
            >
              <RefreshCw className={`w-16 h-16 ${isSpinning ? 'text-red-400 animate-spin' : 'text-emerald-deep group-hover:rotate-180 transition-transform duration-1000 ease-in-out'}`} />
            </motion.button>
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 font-display italic text-sm font-black text-gold-light uppercase tracking-[0.5em] opacity-40 skew-x-[-10deg]">INITIATE</div>
          </div>

          {/* Stats Display - Digital Readout */}
          <div className="flex flex-col items-end">
            <span className="text-[11px] font-display italic uppercase tracking-[0.4em] text-gold-light/40 mb-3 mr-2">SESSION METRICS</span>
            <div className="glass-panel px-10 py-5 rounded-[2rem] border border-white/10 shadow-2xl bg-black/40 flex flex-col items-end">
              <span className="font-mono font-black text-4xl text-gold-light tracking-tighter neon-text">{stats.spins.toString().padStart(5, '0')}</span>
              <span className="text-[8px] font-serif italic uppercase tracking-widest text-white/20">total rotations</span>
            </div>
          </div>
        </div>
      </main>

      {/* Win Overlay - Editorial Impact */}
      <AnimatePresence>
        {win && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setWin(null)}
            className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl cursor-pointer"
          >
            <motion.div 
              initial={{ scale: 0.7, y: 100, rotate: -5 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              className="text-center pointer-events-none"
            >
              <motion.div 
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mb-6"
              >
                <Trophy className="w-24 h-24 text-gold-light mx-auto glow-gold" />
              </motion.div>
              
              <h2 className={`font-display italic font-black tracking-tighter uppercase leading-none ${
                win.type === 'MEGA' ? 'text-[12rem] text-gold-light skew-x-[-15deg]' : 
                win.type === 'BIG' ? 'text-[10rem] text-gold skew-x-[-10deg]' : 'text-[8rem] text-gold-dark skew-x-[-5deg]'
              }`}>
                {win.type === 'MEGA' ? 'MEGA' : win.type === 'BIG' ? 'BIG' : 'WIN'}
              </h2>
              
              {win.type !== 'SMALL' && win.type !== 'LDW' && (
                <h3 className="font-display text-5xl font-black italic text-white/20 -mt-8 tracking-[0.5em] uppercase">FORTUNE</h3>
              )}

              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: "spring" }}
                className="mt-12 font-mono text-9xl font-black text-white tracking-tighter neon-text"
              >
                ${win.amount.toLocaleString()}
              </motion.div>
            </motion.div>
            
            <div className="mt-24 font-serif italic text-sm uppercase tracking-[0.6em] text-gold-light/30 animate-pulse">
              COLLECT WINNINGS
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paytable Modal - Magazine Layout */}
      <AnimatePresence>
        {showPaytable && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 200 }}
            className="fixed inset-0 z-[110] bg-emerald-deep p-16 overflow-y-auto felt-texture"
          >
            <div className="max-w-5xl mx-auto">
              <div className="flex justify-between items-start mb-20">
                <div className="flex flex-col">
                  <h2 className="font-display text-9xl font-black italic text-gold-light tracking-tighter skew-x-[-10deg] leading-none">PAY</h2>
                  <h2 className="font-display text-9xl font-black italic text-white/10 tracking-tighter skew-x-[-10deg] leading-none -mt-4 ml-12">TABLE</h2>
                </div>
                <button onClick={() => setShowPaytable(false)} className="w-20 h-20 rounded-[2rem] glass-panel flex items-center justify-center text-gold-light hover:rotate-90 transition-all duration-500">
                  <X className="w-10 h-10" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {SYMBOLS.map(s => (
                  <div key={s.id} className="flex items-center gap-10 glass-panel p-8 rounded-[2.5rem] border-l-8 border-gold shadow-2xl group hover:bg-white/5 transition-all">
                    <div className="w-28 h-28 flex-shrink-0 bg-black/60 border border-white/10 rounded-[2rem] flex items-center justify-center text-5xl group-hover:scale-110 transition-transform">
                      {typeof s.icon === 'function' ? <s.icon /> : <s.icon className="w-14 h-14 glow-gold" style={{ color: s.color }} />}
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-10">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-display italic uppercase tracking-widest text-gold-light/40 mb-2">5X COMBO</span>
                        <span className="font-mono font-black text-3xl text-gold-light tracking-tighter">${s.value * PAYOUTS[5]}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-display italic uppercase tracking-widest text-white/10 mb-2">4X COMBO</span>
                        <span className="font-mono font-black text-3xl text-white/60 tracking-tighter">${s.value * PAYOUTS[4]}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-display italic uppercase tracking-widest text-white/10 mb-2">3X COMBO</span>
                        <span className="font-mono font-black text-3xl text-white/40 tracking-tighter">${s.value * PAYOUTS[3]}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-24 p-12 glass-panel rounded-[3rem] text-center border border-gold/10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold/40 to-transparent"></div>
                <h4 className="font-display text-3xl text-gold-light mb-6 italic tracking-[0.3em] uppercase skew-x-[-5deg]">REGULATORY DISCLOSURE</h4>
                <p className="text-white/30 text-base font-light leading-relaxed max-w-2xl mx-auto font-serif italic">
                  "Only the highest win paid per line. Wins are calculated on the middle payline. 
                  Wild symbols substitute for all standard icons. Theoretical Return to Player (RTP) is fixed at 92.00%."
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation - Luxury Rail */}
      <nav className="flex justify-around items-center px-12 h-28 glass-panel border-t border-white/5 z-50 bg-black/40">
        <button className="flex flex-col items-center justify-center metallic-gold text-emerald-deep rounded-[1.5rem] px-14 py-4 shadow-2xl transform -translate-y-4 transition-all hover:scale-105 active:scale-95">
          <Menu className="w-6 h-6 mb-1" />
          <span className="font-display italic font-black uppercase tracking-[0.2em] text-[11px]">TERMINAL</span>
        </button>
        <button className="flex flex-col items-center justify-center text-gold-light/30 px-10 py-4 hover:text-gold-light transition-all group">
          <History className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
          <span className="font-serif italic uppercase tracking-[0.3em] text-[10px]">LEDGER</span>
        </button>
        <button className="flex flex-col items-center justify-center text-gold-light/30 px-10 py-4 hover:text-gold-light transition-all group">
          <Trophy className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
          <span className="font-serif italic uppercase tracking-[0.3em] text-[10px]">HALL OF FAME</span>
        </button>
      </nav>
    </div>
  );
}
