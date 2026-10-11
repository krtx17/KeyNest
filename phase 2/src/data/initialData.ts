import { Category, Teammate, VaultItem, CurrentUser } from '../types/vault';

/**
 * Production Initial Data
 * Zero demo users, zero seeded credentials, zero fake teammates.
 * All accounts start with an empty vault and user-created data only.
 */

export const CURRENT_USER: CurrentUser | null = null;

export const INITIAL_CATEGORIES: Category[] = [];

export const INITIAL_TEAMMATES: Teammate[] = [];

export const INITIAL_ITEMS: VaultItem[] = [];
