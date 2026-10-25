/**
 * src/ai/assistant.ts
 *
 * Offline Campus Assistant coordinator.
 * Lifecycle:
 * 1. Executes Dexie local retrieval (retrieve.ts)
 * 2. Checks hardware capability & model readiness
 * 3. If WebGPU + model ready: streams inference via Web Worker
 * 4. Fallback: Formats structured ranked recommendation cards directly from retrieval
 */

import { retrieveContextForQuery, RetrievedCandidate } from './retrieve';
import { checkAIEngineCapability, getModelStatus } from './gemmaLoader';

export interface AssistantAnswer {
  text: string;
  sources: RetrievedCandidate[];
  usedFallback: boolean;
  engine: 'Gemma WebGPU (Local Worker)' | 'Offline Local Search Engine';
}

type StreamCallback = (chunk: string) => void;

class AssistantCoordinator {
  private worker: Worker | null = null;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./assistant.worker.ts', import.meta.url), {
        type: 'module'
      });
    }
    return this.worker;
  }

  public async ask(
    userQuestion: string,
    onStreamChunk?: StreamCallback
  ): Promise<AssistantAnswer> {
    // 1. Local Retrieval from Dexie
    const candidates = await retrieveContextForQuery(userQuestion);

    // Format context lines
    const contextLines = candidates.map(c => {
      let label = c.building.name;
      if (c.room) {
        label += ` - Room ${c.room.room_number} (${c.room.name || c.room.type}), Floor ${c.floorLevel || 1}`;
      }
      const extras = [
        c.distanceMeters !== undefined ? `${c.distanceMeters}m away` : null,
        c.crowdLevel ? `Crowd: ${c.crowdLevel}` : null,
        c.matchedReasons.length > 0 ? `Matches: ${c.matchedReasons.join(', ')}` : null
      ].filter(Boolean).join(' | ');

      return `${label}: ${extras}`;
    });

    const contextPayload = contextLines.join('\n');

    // 2. Hardware Capability Check
    const capability = await checkAIEngineCapability();
    const modelStatus = await getModelStatus();

    // System prompt instructing strictly grounded answers
    const systemPrompt = `You are Quadrant, an offline campus assistant. Answer ONLY using the facts from the local campus database below. Name the exact building, floor level, and room number where applicable. Be concise and friendly.`;

    // 3. Inference or Fallback
    if (capability.canRunModel && modelStatus === 'ready' && typeof Worker !== 'undefined') {
      try {
        const generated = await this.runWorkerInference(
          systemPrompt,
          userQuestion,
          contextPayload,
          onStreamChunk
        );

        return {
          text: generated,
          sources: candidates,
          usedFallback: false,
          engine: 'Gemma WebGPU (Local Worker)'
        };
      } catch (err) {
        console.warn('[Assistant] Worker inference failed, falling back to local search ranking:', err);
      }
    }

    // 4. Graceful Offline Fallback (Architecture Plan page 6: "Fallback: show retrieval results as a ranked list, which still answers the question offline")
    const fallbackAnswer = this.formatFallbackResponse(userQuestion, candidates);
    if (onStreamChunk) {
      onStreamChunk(fallbackAnswer);
    }

    return {
      text: fallbackAnswer,
      sources: candidates,
      usedFallback: true,
      engine: 'Offline Local Search Engine'
    };
  }

  private runWorkerInference(
    systemPrompt: string,
    userPrompt: string,
    context: string,
    onChunk?: StreamCallback
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const worker = this.getWorker();
      const reqId = `inf-${Date.now()}`;
      let accumulated = '';

      const handleMessage = (e: MessageEvent) => {
        const res = e.data;
        if (res.id !== reqId) return;

        if (res.type === 'TOKEN' && res.content) {
          accumulated += res.content;
          if (onChunk) onChunk(res.content);
        } else if (res.type === 'COMPLETE') {
          cleanup();
          resolve(accumulated);
        } else if (res.type === 'ERROR') {
          cleanup();
          reject(new Error(res.error || 'Worker generation error'));
        }
      };

      const cleanup = () => {
        worker.removeEventListener('message', handleMessage);
      };

      worker.addEventListener('message', handleMessage);

      worker.postMessage({
        id: reqId,
        type: 'GENERATE',
        systemPrompt,
        userPrompt,
        context
      });
    });
  }

  private formatFallbackResponse(query: string, candidates: RetrievedCandidate[]): string {
    if (candidates.length === 0) {
      return `I couldn't find any campus locations matching "${query}". Try searching for rooms, amenities like "outlets", "quiet study", or building names like "Library".`;
    }

    const top = candidates[0];
    let title = top.building.name;
    if (top.room) {
      title += ` (Room ${top.room.room_number} - ${top.room.name || top.room.type}, Floor ${top.floorLevel || 1})`;
    }

    let summary = `📍 Top recommendation: **${title}**\n\n`;
    if (top.matchedReasons.length > 0) {
      summary += `Why it fits:\n` + top.matchedReasons.map(r => `• ${r}`).join('\n') + '\n\n';
    }

    if (top.crowdLevel) {
      summary += `• Live crowd status: **${top.crowdLevel.toUpperCase()}**\n`;
    }
    summary += `• Building Hours: ${top.building.hours}\n`;
    summary += `• Accessibility: ${top.building.accessibility_notes || 'Step-free entry'}\n\n`;

    if (candidates.length > 1) {
      summary += `Other close options:\n`;
      candidates.slice(1, 4).forEach((c, i) => {
        const place = c.room
          ? `${c.building.name} Rm ${c.room.room_number}`
          : c.building.name;
        summary += `${i + 2}. **${place}** ${c.distanceMeters ? `(${c.distanceMeters}m away)` : ''}\n`;
      });
    }

    return summary;
  }
}

export const assistant = new AssistantCoordinator();
