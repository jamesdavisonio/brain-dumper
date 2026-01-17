/**
 * Proposal Storage module
 * Stores and retrieves scheduling proposals for the approval flow
 * @module scheduling/proposalStorage
 */

import * as admin from 'firebase-admin';
import { ScheduleProposal } from '../types';

const db = admin.firestore();

/**
 * Firestore collection path for schedule proposals
 */
const PROPOSALS_COLLECTION = 'scheduleProposals';

/**
 * Default proposal expiry time in milliseconds (1 hour)
 */
const DEFAULT_PROPOSAL_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Get the Firestore path for a user's proposals collection
 * @param userId - User's Firebase UID
 * @returns Firestore collection path
 */
function getProposalsPath(userId: string): string {
  return `users/${userId}/${PROPOSALS_COLLECTION}`;
}

/**
 * Generate a unique proposal ID
 * @returns Unique proposal ID
 */
function generateProposalId(): string {
  return `proposal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Store a schedule proposal for user approval
 *
 * @param userId - User's Firebase UID
 * @param proposal - Schedule proposal (without id, createdAt, expiresAt)
 * @param expiryMs - Expiry time in milliseconds (default 1 hour)
 * @returns Proposal ID
 *
 * @example
 * const proposalId = await storeProposal('user123', {
 *   proposedSlots: [...],
 *   unschedulable: [...],
 *   summary: {...}
 * });
 */
export async function storeProposal(
  userId: string,
  proposal: Omit<ScheduleProposal, 'id' | 'userId' | 'createdAt' | 'expiresAt'>,
  expiryMs: number = DEFAULT_PROPOSAL_EXPIRY_MS
): Promise<string> {
  const proposalId = generateProposalId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryMs);

  const fullProposal: ScheduleProposal = {
    ...proposal,
    id: proposalId,
    userId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const docRef = db.collection(getProposalsPath(userId)).doc(proposalId);
  await docRef.set(fullProposal);

  console.log(`Stored proposal ${proposalId} for user ${userId}, expires at ${expiresAt.toISOString()}`);

  return proposalId;
}

/**
 * Retrieve a schedule proposal
 *
 * @param userId - User's Firebase UID
 * @param proposalId - Proposal ID
 * @returns Schedule proposal or null if not found/expired
 *
 * @example
 * const proposal = await getProposal('user123', 'proposal_123');
 */
export async function getProposal(
  userId: string,
  proposalId: string
): Promise<ScheduleProposal | null> {
  const docRef = db.collection(getProposalsPath(userId)).doc(proposalId);
  const doc = await docRef.get();

  if (!doc.exists) {
    console.log(`Proposal ${proposalId} not found for user ${userId}`);
    return null;
  }

  const proposal = doc.data() as ScheduleProposal;

  // Check if proposal has expired
  if (new Date(proposal.expiresAt) < new Date()) {
    console.log(`Proposal ${proposalId} has expired`);
    // Delete expired proposal
    await docRef.delete();
    return null;
  }

  return proposal;
}

/**
 * Delete a proposal after it's been processed
 *
 * @param userId - User's Firebase UID
 * @param proposalId - Proposal ID
 *
 * @example
 * await deleteProposal('user123', 'proposal_123');
 */
export async function deleteProposal(
  userId: string,
  proposalId: string
): Promise<void> {
  const docRef = db.collection(getProposalsPath(userId)).doc(proposalId);
  await docRef.delete();
  console.log(`Deleted proposal ${proposalId} for user ${userId}`);
}

/**
 * Get all pending proposals for a user
 *
 * @param userId - User's Firebase UID
 * @returns Array of non-expired proposals
 *
 * @example
 * const proposals = await getPendingProposals('user123');
 */
export async function getPendingProposals(
  userId: string
): Promise<ScheduleProposal[]> {
  const now = new Date().toISOString();
  const collectionRef = db.collection(getProposalsPath(userId));

  const snapshot = await collectionRef
    .where('expiresAt', '>', now)
    .orderBy('expiresAt')
    .get();

  const proposals: ScheduleProposal[] = [];
  snapshot.forEach((doc) => {
    proposals.push(doc.data() as ScheduleProposal);
  });

  return proposals;
}

/**
 * Clean up expired proposals for a user
 *
 * @param userId - User's Firebase UID
 * @returns Number of proposals deleted
 *
 * @example
 * const deleted = await cleanupUserExpiredProposals('user123');
 */
export async function cleanupUserExpiredProposals(
  userId: string
): Promise<number> {
  const now = new Date().toISOString();
  const collectionRef = db.collection(getProposalsPath(userId));

  const snapshot = await collectionRef
    .where('expiresAt', '<=', now)
    .get();

  if (snapshot.empty) {
    return 0;
  }

  const batch = db.batch();
  snapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  console.log(`Cleaned up ${snapshot.size} expired proposals for user ${userId}`);
  return snapshot.size;
}

/**
 * Clean up all expired proposals across all users
 * This should be run as a scheduled function
 *
 * @returns Total number of proposals deleted
 *
 * @example
 * // In a scheduled Cloud Function
 * const deleted = await cleanupExpiredProposals();
 */
export async function cleanupExpiredProposals(): Promise<number> {
  let totalDeleted = 0;

  // Get all users
  const usersSnapshot = await db.collection('users').get();

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;

    try {
      const deleted = await cleanupUserExpiredProposals(userId);
      totalDeleted += deleted;
    } catch (error) {
      console.error(`Error cleaning up proposals for user ${userId}:`, error);
    }
  }

  console.log(`Total expired proposals cleaned up: ${totalDeleted}`);
  return totalDeleted;
}

/**
 * Update a proposal (e.g., to mark slots as approved/rejected)
 *
 * @param userId - User's Firebase UID
 * @param proposalId - Proposal ID
 * @param updates - Partial proposal updates
 *
 * @example
 * await updateProposal('user123', 'proposal_123', {
 *   proposedSlots: updatedSlots
 * });
 */
export async function updateProposal(
  userId: string,
  proposalId: string,
  updates: Partial<Omit<ScheduleProposal, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  const docRef = db.collection(getProposalsPath(userId)).doc(proposalId);
  await docRef.update(updates);
  console.log(`Updated proposal ${proposalId} for user ${userId}`);
}

/**
 * Extend the expiry time of a proposal
 *
 * @param userId - User's Firebase UID
 * @param proposalId - Proposal ID
 * @param extensionMs - Additional time in milliseconds
 * @returns New expiry time
 *
 * @example
 * const newExpiry = await extendProposalExpiry('user123', 'proposal_123', 30 * 60 * 1000);
 */
export async function extendProposalExpiry(
  userId: string,
  proposalId: string,
  extensionMs: number
): Promise<string> {
  const proposal = await getProposal(userId, proposalId);

  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found or expired`);
  }

  const currentExpiry = new Date(proposal.expiresAt);
  const newExpiry = new Date(currentExpiry.getTime() + extensionMs);

  await updateProposal(userId, proposalId, {
    expiresAt: newExpiry.toISOString(),
  });

  return newExpiry.toISOString();
}

/**
 * Check if a proposal exists and is valid
 *
 * @param userId - User's Firebase UID
 * @param proposalId - Proposal ID
 * @returns True if proposal exists and hasn't expired
 *
 * @example
 * if (await isProposalValid('user123', 'proposal_123')) {
 *   // Process proposal
 * }
 */
export async function isProposalValid(
  userId: string,
  proposalId: string
): Promise<boolean> {
  const proposal = await getProposal(userId, proposalId);
  return proposal !== null;
}
