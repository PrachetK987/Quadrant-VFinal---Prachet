/**
 * src/sync/conflict.ts
 *
 * Conflict resolution rules per table:
 * 1. Append-only tables (reviews, photos, tips, routes, check_ins): No conflicts.
 * 2. Crowd reports: Append-only, auto-filtered if older than 45 min TTL.
 * 3. Own review / profile edits: Last-write-wins (LWW) by server updated_at timestamp.
 * 4. Building reference: Authoritative from server pack / suggestions moderation.
 * 5. Soft deletes: Row with newer updated_at and deleted_at flag wins.
 */

import { BaseEntity, CrowdReport } from '../types';

export function resolveLastWriteWins<T extends BaseEntity>(local: T | undefined, incoming: T): T {
  if (!local) return incoming;

  const localTime = new Date(local.updated_at).getTime();
  const incomingTime = new Date(incoming.updated_at).getTime();

  // If incoming row is newer, it wins
  if (incomingTime >= localTime) {
    return incoming;
  }
  return local;
}

export function isCrowdReportExpired(report: CrowdReport): boolean {
  if (!report.expires_at) return true;
  return new Date(report.expires_at).getTime() < Date.now();
}

export function filterActiveCrowdReports(reports: CrowdReport[]): CrowdReport[] {
  const now = Date.now();
  return reports.filter(r => !r.deleted_at && new Date(r.expires_at).getTime() > now);
}
