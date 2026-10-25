/**
 * src/sync/outbox.ts
 *
 * Outbox manager for queueing local writes while offline.
 * Every mutating repository call invokes `queueOutboxWrite` inside
 * the same Dexie transaction as the local write.
 */

import { db } from '../db/schema';
import type { OutboxEntry, OutboxOperation } from '../types';

export async function queueOutboxWrite(
  tableName: string,
  operation: OutboxOperation,
  payload: any
): Promise<OutboxEntry> {
  const entry: OutboxEntry = {
    id: `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    table_name: tableName,
    operation,
    payload,
    created_at: new Date().toISOString(),
    retry_count: 0
  };

  await db.outbox.put(entry);
  return entry;
}

export async function getPendingOutboxEntries(): Promise<OutboxEntry[]> {
  return await db.outbox.orderBy('created_at').toArray();
}

export async function removeOutboxEntry(id: string): Promise<void> {
  await db.outbox.delete(id);
}

export async function markOutboxFailure(id: string, errorMessage: string): Promise<void> {
  const existing = await db.outbox.get(id);
  if (existing) {
    await db.outbox.put({
      ...existing,
      retry_count: (existing.retry_count || 0) + 1,
      last_error: errorMessage
    });
  }
}

export async function clearOutbox(): Promise<void> {
  await db.outbox.clear();
}
