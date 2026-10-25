/**
 * src/features/assistant/AssistantScreen.tsx
 *
 * Local Gemma AI Assistant view with:
 * - Hardware capability inspection badge (WebGPU + Storage Quota)
 * - Grounded queries against Dexie database (tags, amenities, crowd, hours)
 * - Ranked ground context inspection cards
 * - Graceful fallback mode indicator
 */

import React, { useEffect, useState } from 'react';
import { assistant, AssistantAnswer } from '../../ai/assistant';
import { checkAIEngineCapability, HardwareCapability, getModelStatus, setModelStatus } from '../../ai/gemmaLoader';
import {
  Sparkles,
  Send,
  Cpu,
  HardDrive,
  CheckCircle,
  HelpCircle,
  Compass,
  ArrowRight,
  Bot
} from 'lucide-react';

interface AssistantScreenProps {
  onOpenBuilding: (buildingId: string, targetRoom?: string) => void;
}

export const AssistantScreen: React.FC<AssistantScreenProps> = ({ onOpenBuilding }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [capability, setCapability] = useState<HardwareCapability | null>(null);
  const [modelState, setModelState] = useState<string>('fallback_mode');
  const [history, setHistory] = useState<
    Array<{
      question: string;
      answer: AssistantAnswer;
    }>
  >([]);

  useEffect(() => {
    checkAIEngineCapability().then(setCapability);
    getModelStatus().then(setModelState);
  }, []);

  const handleSend = async (questionToSend?: string) => {
    const prompt = questionToSend || query;
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setQuery('');

    try {
      const response = await assistant.ask(prompt);
      setHistory(prev => [
        ...prev,
        {
          question: prompt,
          answer: response
        }
      ]);
    } catch (err) {
      console.error('Assistant error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadModel = async () => {
    setModelState('downloading');
    // Simulate model cache progress into Cache Storage
    setTimeout(async () => {
      await setModelStatus('ready');
      setModelState('ready');
    }, 2000);
  };

  const samplePrompts = [
    'Where is a quiet place with outlets near Science Hall?',
    'Where can I heat up lunch and find a microwave?',
    'Quiet study room on floor 2 of the Library',
    'Which computer labs have dual monitors?'
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Engine Status Top Header */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <Bot className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-white">Quadrant Local Assistant</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
            {modelState === 'ready' ? '⚡ Gemma WebGPU' : '🔍 Local Search Fallback'}
          </span>
        </div>

        {modelState !== 'ready' && capability?.hasWebGPU && (
          <button
            onClick={handleDownloadModel}
            disabled={modelState === 'downloading'}
            className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold transition"
          >
            {modelState === 'downloading' ? 'Caching Model...' : 'Enable Gemma (WebGPU)'}
          </button>
        )}
      </div>

      {/* Messages / Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {history.length === 0 ? (
          <div className="max-w-lg mx-auto py-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-base font-bold text-white">100% Offline Campus Intelligence</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Ask questions about quiet study spots, outlets, room locations, or microwave stations. Queries never leave your phone.
              </p>
            </div>

            {/* Quick Prompts */}
            <div className="grid grid-cols-1 gap-2 pt-2 text-left">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 text-center block">
                Suggested Questions
              </span>
              {samplePrompts.map(p => (
                <button
                  key={p}
                  onClick={() => handleSend(p)}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition flex items-center justify-between group"
                >
                  <span>{p}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          history.map((item, idx) => (
            <div key={idx} className="space-y-3 max-w-2xl mx-auto">
              {/* User Question */}
              <div className="flex justify-end">
                <div className="bg-sky-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-xs max-w-[85%] font-medium">
                  {item.question}
                </div>
              </div>

              {/* Assistant Grounded Answer */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    <span className="font-semibold text-slate-200">{item.answer.engine}</span>
                  </div>
                  <span>{item.answer.usedFallback ? 'Ranked Retrieval' : 'Worker Streamed'}</span>
                </div>

                <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                  {item.answer.text}
                </div>

                {/* Grounded Source Cards */}
                {item.answer.sources.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Local Database Grounds
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {item.answer.sources.slice(0, 2).map((s, sIdx) => (
                        <div
                          key={sIdx}
                          onClick={() => onOpenBuilding(s.building.id, s.room?.room_number)}
                          className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-sky-500/50 cursor-pointer transition flex items-center justify-between"
                        >
                          <div>
                            <span className="text-xs font-bold text-white block">
                              {s.building.name}
                            </span>
                            <span className="text-[10px] text-sky-400">
                              {s.room ? `Room ${s.room.room_number}` : 'Main Facility'}
                              {s.distanceMeters && ` · ${s.distanceMeters}m`}
                            </span>
                          </div>
                          <Compass className="w-4 h-4 text-slate-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-3 max-w-2xl mx-auto flex items-center space-x-2 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-sky-400 animate-spin" />
            <span>Retrieving local campus database facts...</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="p-3 bg-slate-900 border-t border-slate-800">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2 max-w-2xl mx-auto"
        >
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ask offline assistant (e.g. quiet study near science hall)..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition shadow"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
