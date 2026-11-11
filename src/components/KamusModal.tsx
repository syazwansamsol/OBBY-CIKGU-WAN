import React, { useState } from 'react';
import {
  PETIKAN_PUSTAKA_MINI,
  KAMUS_DEWAN_ENTRIES,
  KamusEntry
} from '../game/quizData';
import { BookOpen, Search, X, Sparkles, CheckCircle2 } from 'lucide-react';

interface KamusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KamusModal: React.FC<KamusModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'petikan' | 'kamus' | 'rujukan'>('petikan');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWord, setSelectedWord] = useState<KamusEntry>(KAMUS_DEWAN_ENTRIES[0]);

  if (!isOpen) return null;

  const filteredEntries = KAMUS_DEWAN_ENTRIES.filter(
    (entry) =>
      entry.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.meaning.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleWordClick = (word: string) => {
    const clean = word.replace(/[.,]/g, '').toLowerCase();
    const found = KAMUS_DEWAN_ENTRIES.find((e) => e.word.toLowerCase() === clean);
    if (found) {
      setSelectedWord(found);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Petikan Buku Teks Pustaka Mini Keluarga dan Kamus Pelajar Dewan"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 pointer-events-auto"
    >
      <div className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-2xl bg-slate-900 border-2 border-amber-400/60 shadow-2xl overflow-hidden text-slate-100">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-amber-300">
                Pustaka Mini Keluarga & Kamus Pelajar Dewan
              </h2>
              <p className="text-xs text-slate-400">
                Standard Pembelajaran 2.1.2 · Baca dan cari makna perkataan dengan merujuk kamus & media elektronik
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Kamus dan Petikan"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700"
          >
            <X className="w-4 h-4" />
            <span>Kembali ke Game</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 bg-slate-900 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('petikan')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'petikan'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            1. Petikan: Pustaka Mini Keluarga
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kamus')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'kamus'
                ? 'bg-sky-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            2. Kamus Pelajar Dewan (m/s 538–539)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rujukan')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'rujukan'
                ? 'bg-emerald-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            3. Lembaran Buku Teks Asal
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'petikan' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 7 Cols: Interactive Reading Passage */}
              <div className="lg:col-span-7 bg-slate-950 rounded-2xl p-6 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-semibold text-amber-400">
                      PETIKAN BUKU TEKS BAHASA MELAYU (HALAMAN 8)
                    </span>
                    <h3 className="font-display text-2xl font-bold text-white mt-0.5">
                      {PETIKAN_PUSTAKA_MINI.title}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">Klik perkataan berwarna untuk makna</span>
                </div>

                <div className="space-y-4 text-base leading-relaxed text-slate-200">
                  {PETIKAN_PUSTAKA_MINI.paragraphs.map((para, pIdx) => {
                    const tokens = para.split(' ');
                    return (
                      <p key={pIdx} className="indent-6">
                        {tokens.map((token, tIdx) => {
                          const clean = token.replace(/[.,]/g, '').toLowerCase();
                          const isHighlighted = PETIKAN_PUSTAKA_MINI.highlightedWords.includes(clean);
                          const isBoxedInTextbook = clean === 'jinjing' || clean === 'kandar';
                          if (isHighlighted) {
                            return (
                              <React.Fragment key={tIdx}>
                                <button
                                  type="button"
                                  onClick={() => handleWordClick(clean)}
                                  className={`inline font-bold px-1.5 py-0.5 rounded transition-colors ${
                                    isBoxedInTextbook
                                      ? 'bg-sky-500/25 text-sky-300 border border-sky-400 hover:bg-sky-500/40'
                                      : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/35'
                                  }`}
                                >
                                  {token}
                                </button>{' '}
                              </React.Fragment>
                            );
                          }
                          return <span key={tIdx}>{token} </span>;
                        })}
                      </p>
                    );
                  })}
                </div>
              </div>

              {/* Right 5 Cols: Selected Word Kamus Dewan Card */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-950 rounded-2xl p-5 border-2 border-sky-400/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400">
                      KAMUS PELAJAR BAHASA MELAYU DEWAN
                    </span>
                    {selectedWord.page && (
                      <span className="text-xs font-mono text-slate-400 tabular-nums">
                        Halaman {selectedWord.page}
                      </span>
                    )}
                  </div>

                  <div className="pt-1">
                    <h4 className="font-display text-3xl font-bold text-amber-300">
                      {selectedWord.word}
                    </h4>
                    <p className="mt-2 text-base font-medium text-white leading-snug">
                      {selectedWord.meaning}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="text-xs font-semibold text-emerald-400">Contoh Ayat:</div>
                    <p className="text-sm text-slate-200 italic">&ldquo;{selectedWord.example}&rdquo;</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Gambaran Aksi / Visual:</span>
                    </div>
                    <p className="text-xs text-slate-300">{selectedWord.visualCue}</p>
                  </div>
                </div>

                {/* Quick selector chips for the 5 key carrying verbs */}
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-2.5">
                  <div className="text-xs font-bold text-slate-300">
                    5 Kosa Kata Tugasan Ibu Kishan (Cara Membawa):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['jinjing', 'tatang', 'pangku', 'dukung', 'kandar', 'junjung'].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => handleWordClick(w)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          selectedWord.word === w
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'kamus' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari perkataan dalam Kamus Pelajar (cth: jinjing, kandar, kedap, pustaka)..."
                    aria-label="Cari perkataan dalam Kamus Pelajar"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div className="text-xs text-slate-400 tabular-nums">
                  Menunjukkan {filteredEntries.length} entri kamus
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredEntries.map((item) => (
                  <div
                    key={item.word}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-lg font-bold text-amber-300">
                        {item.word}
                      </span>
                      {item.page && (
                        <span className="text-xs font-mono text-slate-400 tabular-nums">
                          m/s {item.page}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white font-medium">{item.meaning}</p>
                    <p className="text-xs text-slate-400 italic">&ldquo;{item.example}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rujukan' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-sm text-amber-300">
                    Rujukan 1: Petikan Pustaka Mini Keluarga (Halaman 8)
                  </h3>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <img
                  src="/assets/aistudio/Screenshot_2026-11-07_at_9.05.35_PM_fdad0a07.png"
                  alt="Halaman Buku Teks Pustaka Mini Keluarga dan Kamus Pelajar Bahasa Melayu Dewan"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-[420px] object-contain rounded-xl bg-slate-900 border border-slate-800"
                />
              </div>

              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-sm text-sky-300">
                    Rujukan 2: Reka Bentuk Game Gaya Roblox (Obby Adventure)
                  </h3>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <img
                  src="/assets/aistudio/Screenshot_2026-11-07_at_10.32.17_PM_bd1ce518.png"
                  alt="Rujukan Reka Bentuk Game Gaya Roblox Obby Adventure"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-[420px] object-contain rounded-xl bg-slate-900 border border-slate-800"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
