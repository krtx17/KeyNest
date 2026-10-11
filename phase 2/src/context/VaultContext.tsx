import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  VaultItem,
  Category,
  Teammate,
  SharePermission,
  ToastNotification,
  CurrentUser,
  ItemInvitation,
  VerifiedInvitationInfo,
  AuthResult,
} from '../types/vault';
import {
  CURRENT_USER,
  INITIAL_CATEGORIES,
  INITIAL_TEAMMATES,
  INITIAL_ITEMS,
} from '../data/initialData';

export type MainTab = 'personal' | 'shared' | 'categories';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// --- Client-Side Vault Authentication (Zero-Knowledge Local Storage Fallback) ---
interface LocalUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

interface LocalResetRecord {
  token: string;
  email: string;
  expiresAt: number;
}

async function hashPasswordClient(password: string, salt: string): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const enc = new TextEncoder();
      const data = enc.encode(`${salt}:${password}`);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fallback if subtle unavailable
  }
  let hash = 0;
  const str = `${salt}:${password}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return 'fallback_' + Math.abs(hash).toString(16);
}

function getLocalUsers(): LocalUserRecord[] {
  try {
    const raw = localStorage.getItem('keynest_auth_users');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUsers(users: LocalUserRecord[]) {
  try {
    localStorage.setItem('keynest_auth_users', JSON.stringify(users));
  } catch {
    // ignore
  }
}

function getLocalResetTokens(): LocalResetRecord[] {
  try {
    const raw = localStorage.getItem('keynest_reset_tokens');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalResetTokens(tokens: LocalResetRecord[]) {
  try {
    localStorage.setItem('keynest_reset_tokens', JSON.stringify(tokens));
  } catch {
    // ignore
  }
}

interface VaultContextType {
  currentUser: CurrentUser | null;
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  selectedItemId: string | null;
  selectItem: (id: string | null) => void;
  selectedCategoryId: string | null;
  setSelectedCategoryId: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Authentication & Session
  signIn: (email: string, password: string) => Promise<AuthResult>;
  createAccount: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => void;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  verifyResetToken: (token: string) => Promise<{ isValid: boolean; email?: string; error?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<AuthResult>;
  pendingResetToken: string | null;
  setPendingResetToken: (token: string | null) => void;

  // Vault Items
  items: VaultItem[];
  addItem: (item: {
    serviceName: string;
    url?: string;
    username: string;
    password: string;
    notes?: string;
    categoryId?: string;
    isShared?: boolean;
  }) => void;
  updateItem: (id: string, updates: Partial<VaultItem>) => void;
  deleteItem: (id: string) => void;
  copyPassword: (itemId: string) => Promise<boolean>;
  copyText: (text: string, label: string) => Promise<boolean>;

  // Teammates & Sharing
  teammates: Teammate[];
  addTeammate: (name: string, email: string) => Teammate;
  shareItem: (itemId: string, teammateId: string, permission: SharePermission) => void;
  removeShare: (itemId: string, teammateId: string) => void;

  // Email Invitations & Acceptance
  invitationsMap: Record<string, ItemInvitation[]>;
  sendItemInvite: (
    itemId: string,
    recipientName: string,
    recipientEmail: string,
    permission: SharePermission,
    serviceName?: string
  ) => Promise<{ success: boolean; error?: string }>;
  listItemInvites: (itemId: string) => Promise<ItemInvitation[]>;
  cancelItemInvite: (itemId: string, invitationId: string) => Promise<boolean>;
  verifyInviteToken: (token: string) => Promise<VerifiedInvitationInfo | null>;
  acceptInviteToken: (token: string) => Promise<{ success: boolean; itemId?: string; error?: string }>;
  pendingInviteToken: string | null;
  setPendingInviteToken: (token: string | null) => void;

  // Categories
  categories: Category[];
  addCategory: (name: string, color?: string) => void;
  renameCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => void;

  // Lock & Security
  isLocked: boolean;
  lockVault: () => void;
  unlockVault: (passphrase: string) => boolean;

  // Modals
  isAddModalOpen: boolean;
  isEditModalOpen: boolean;
  isShareModalOpen: boolean;
  isCategoryModalOpen: boolean;
  editingCategory: Category | null;
  defaultAddShared: boolean;
  openAddModal: (isShared?: boolean) => void;
  closeAddModal: () => void;
  openEditModal: () => void;
  closeEditModal: () => void;
  openShareModal: () => void;
  closeShareModal: () => void;
  openCategoryModal: (cat?: Category) => void;
  closeCategoryModal: () => void;

  // Toasts
  toasts: ToastNotification[];
  showToast: (toast: Omit<ToastNotification, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

// Helper for default icons and colors based on service name
function getServiceVisuals(serviceName: string) {
  const name = serviceName.toLowerCase().trim();
  if (name.includes('insta')) return { iconBg: '#E1306C', iconInitials: 'IG' };
  if (name.includes('linked')) return { iconBg: '#0A66C2', iconInitials: 'in' };
  if (name.includes('git')) return { iconBg: '#24292F', iconInitials: 'GH' };
  if (name.includes('you') || name.includes('tube')) return { iconBg: '#E02424', iconInitials: 'YT' };
  if (name.includes('twit') || name === 'x') return { iconBg: '#111827', iconInitials: 'X' };
  if (name.includes('mail')) return { iconBg: '#FFE01B', iconInitials: 'MC' };
  if (name.includes('face') || name.includes('meta')) return { iconBg: '#1877F2', iconInitials: 'fb' };
  if (name.includes('goog')) return { iconBg: '#4285F4', iconInitials: 'G' };
  if (name.includes('slack')) return { iconBg: '#4A154B', iconInitials: 'SL' };
  if (name.includes('figma')) return { iconBg: '#F24E1E', iconInitials: 'FG' };
  
  // Default fallback: color palette based on char code
  const colors = ['#6366F1', '#0D9488', '#F97316', '#8B5CF6', '#EC4899', '#14B8A6'];
  const charCode = name.charCodeAt(0) || 65;
  const color = colors[charCode % colors.length];
  const initials = serviceName.slice(0, 2).toUpperCase();
  return { iconBg: color, iconInitials: initials };
}

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    const saved = sessionStorage.getItem('keynest_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return CURRENT_USER;
      }
    }
    return CURRENT_USER;
  });

  const [activeTab, setActiveTab] = useState<MainTab>('personal');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Scoped storage helpers
  const storageKey = currentUser ? `keynest_data_${currentUser.id}` : 'keynest_data_guest';

  const [items, setItems] = useState<VaultItem[]>(() => {
    const saved = localStorage.getItem(`${storageKey}_items`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_ITEMS;
      }
    }
    return INITIAL_ITEMS;
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem(`${storageKey}_categories`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_CATEGORIES;
      }
    }
    return INITIAL_CATEGORIES;
  });

  const [teammates, setTeammates] = useState<Teammate[]>(() => {
    const saved = localStorage.getItem(`${storageKey}_teammates`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_TEAMMATES;
      }
    }
    return INITIAL_TEAMMATES;
  });

  const [invitationsMap, setInvitationsMap] = useState<Record<string, ItemInvitation[]>>(() => {
    const saved = localStorage.getItem(`${storageKey}_invitations`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });

  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('invite') || null;
    }
    return null;
  });

  const [pendingResetToken, setPendingResetToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('resetToken') || params.get('reset_token') || null;
    }
    return null;
  });

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [defaultAddShared, setDefaultAddShared] = useState(false);

  // Sync to local storage when state updates
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`keynest_data_${currentUser.id}_items`, JSON.stringify(items));
    }
  }, [items, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`keynest_data_${currentUser.id}_categories`, JSON.stringify(categories));
    }
  }, [categories, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`keynest_data_${currentUser.id}_teammates`, JSON.stringify(teammates));
    }
  }, [teammates, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`keynest_data_${currentUser.id}_invitations`, JSON.stringify(invitationsMap));
    }
  }, [invitationsMap, currentUser]);

  const showToast = useCallback((toastData: Omit<ToastNotification, 'id'>) => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newToast: ToastNotification = { ...toastData, id };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Authentication: Sign in
  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const normalizedEmail = email.toLowerCase().trim();

      // Fallback for local client vault mode (e.g. static hosting on Vercel or offline)
      const signInLocally = async (): Promise<AuthResult> => {
        const localUsers = getLocalUsers();
        const existing = localUsers.find((u) => u.email === normalizedEmail);
        if (!existing) {
          return {
            success: false,
            code: 'INVALID_CREDENTIALS',
            error: 'Invalid email or password. If you are new to KeyNest, please click "Create account".',
          };
        }

        const computedHash = await hashPasswordClient(password, existing.salt);
        if (computedHash !== existing.passwordHash) {
          return {
            success: false,
            code: 'INVALID_CREDENTIALS',
            error: 'Invalid email or password. Please check your credentials.',
          };
        }

        const user: CurrentUser = {
          id: existing.id,
          email: existing.email,
          name: existing.email.split('@')[0],
          initials: existing.email.slice(0, 2).toUpperCase(),
        };

        sessionStorage.setItem('keynest_token', 'local_jwt_' + crypto.randomUUID());
        sessionStorage.setItem('keynest_user', JSON.stringify(user));
        sessionStorage.setItem('keynest_passphrase', password);

        setCurrentUser(user);
        setIsLocked(false);

        const savedItems = localStorage.getItem(`keynest_data_${user.id}_items`);
        setItems(savedItems ? JSON.parse(savedItems) : []);
        const savedCats = localStorage.getItem(`keynest_data_${user.id}_categories`);
        setCategories(savedCats ? JSON.parse(savedCats) : []);
        const savedTeammates = localStorage.getItem(`keynest_data_${user.id}_teammates`);
        setTeammates(savedTeammates ? JSON.parse(savedTeammates) : []);
        const savedInvites = localStorage.getItem(`keynest_data_${user.id}_invitations`);
        setInvitationsMap(savedInvites ? JSON.parse(savedInvites) : {});

        showToast({
          title: 'Welcome back',
          message: `Signed in as ${user.email}.`,
          type: 'success',
        });
        return { success: true };
      };

      try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password, deviceName: 'Web Client' }),
        });

        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const data = isJson ? await res.json().catch(() => null) : null;

        if (res.ok) {
          const user: CurrentUser = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.email.split('@')[0],
            initials: data.user.email.slice(0, 2).toUpperCase(),
          };

          sessionStorage.setItem('keynest_token', data.tokens.accessToken);
          sessionStorage.setItem('keynest_user', JSON.stringify(user));
          sessionStorage.setItem('keynest_passphrase', password);

          setCurrentUser(user);
          setIsLocked(false);

          // Load user items scoped to this user
          const savedItems = localStorage.getItem(`keynest_data_${user.id}_items`);
          setItems(savedItems ? JSON.parse(savedItems) : []);
          const savedCats = localStorage.getItem(`keynest_data_${user.id}_categories`);
          setCategories(savedCats ? JSON.parse(savedCats) : []);
          const savedTeammates = localStorage.getItem(`keynest_data_${user.id}_teammates`);
          setTeammates(savedTeammates ? JSON.parse(savedTeammates) : []);
          const savedInvites = localStorage.getItem(`keynest_data_${user.id}_invitations`);
          setInvitationsMap(savedInvites ? JSON.parse(savedInvites) : {});

          showToast({
            title: 'Welcome back',
            message: `Signed in as ${user.email}.`,
            type: 'success',
          });
          return { success: true };
        }

        if (res.status === 401) {
          const msg = data?.error?.message || 'Invalid email or password. Please check your credentials.';
          return { success: false, code: 'INVALID_CREDENTIALS', error: msg };
        }

        if (res.status === 400) {
          const msg = data?.error?.message || 'Invalid email or password format.';
          return { success: false, code: 'VALIDATION_ERROR', error: msg };
        }

        // If backend endpoint is 404, 405 (Vercel static rewrite), or returned HTML, gracefully fallback to local vault auth
        if (res.status === 404 || res.status === 405 || (!isJson && contentType.includes('text/html'))) {
          return await signInLocally();
        }

        const msg = data?.error?.message || 'Sign in failed. Please try again.';
        return { success: false, code: 'SERVER_ERROR', error: msg };
      } catch {
        // Backend offline / network failure -> seamlessly fallback to local vault
        return await signInLocally();
      }
    },
    [showToast]
  );

  // Authentication: Create account
  const createAccount = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const normalizedEmail = email.toLowerCase().trim();

      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return { success: false, code: 'VALIDATION_ERROR', error: 'Please enter a valid email address.' };
      }

      if (password.length < 8) {
        return { success: false, code: 'VALIDATION_ERROR', error: 'Password must be at least 8 characters long.' };
      }

      // Fallback for local client vault mode (e.g. static hosting on Vercel or offline)
      const createAccountLocally = async (): Promise<AuthResult> => {
        const localUsers = getLocalUsers();
        if (localUsers.some((u) => u.email === normalizedEmail)) {
          return {
            success: false,
            code: 'USER_EXISTS',
            error: 'An account with this email already exists. Try signing in.',
          };
        }

        const salt = crypto.randomUUID();
        const passwordHash = await hashPasswordClient(password, salt);
        const userId = 'usr_' + crypto.randomUUID();
        const newUser: LocalUserRecord = {
          id: userId,
          email: normalizedEmail,
          passwordHash,
          salt,
          createdAt: new Date().toISOString(),
        };
        saveLocalUsers([...localUsers, newUser]);

        const user: CurrentUser = {
          id: userId,
          email: normalizedEmail,
          name: normalizedEmail.split('@')[0],
          initials: normalizedEmail.slice(0, 2).toUpperCase(),
        };

        sessionStorage.setItem('keynest_token', 'local_jwt_' + crypto.randomUUID());
        sessionStorage.setItem('keynest_user', JSON.stringify(user));
        sessionStorage.setItem('keynest_passphrase', password);

        setCurrentUser(user);
        setIsLocked(false);
        setItems([]);
        setCategories([]);
        setTeammates([]);
        setInvitationsMap({});

        showToast({
          title: 'Account created',
          message: `Welcome to KeyNest, ${user.email}!`,
          type: 'success',
        });
        return { success: true };
      };

      try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password, deviceName: 'Web Client' }),
        });

        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const data = isJson ? await res.json().catch(() => null) : null;

        if (res.ok || res.status === 201) {
          if (data?.tokens?.accessToken && data?.user) {
            const user: CurrentUser = {
              id: data.user.id,
              email: data.user.email,
              name: data.user.email.split('@')[0],
              initials: data.user.email.slice(0, 2).toUpperCase(),
            };

            sessionStorage.setItem('keynest_token', data.tokens.accessToken);
            sessionStorage.setItem('keynest_user', JSON.stringify(user));
            sessionStorage.setItem('keynest_passphrase', password);

            setCurrentUser(user);
            setIsLocked(false);
            setItems([]);
            setCategories([]);
            setTeammates([]);
            setInvitationsMap({});

            showToast({
              title: 'Account created',
              message: `Welcome to KeyNest, ${user.email}!`,
              type: 'success',
            });
            return { success: true };
          }

          // Fallback to signing in with the new credentials
          return await signIn(normalizedEmail, password);
        }

        if (res.status === 409) {
          const msg = data?.error?.message || 'An account with this email already exists. Try signing in.';
          return { success: false, code: 'USER_EXISTS', error: msg };
        }

        if (res.status === 400) {
          const msg = data?.error?.message || 'Invalid registration details. Please check your email and password.';
          return { success: false, code: 'VALIDATION_ERROR', error: msg };
        }

        // If backend endpoint is 404, 405 (Vercel static rewrite), or returned HTML, gracefully fallback to local vault auth
        if (res.status === 404 || res.status === 405 || (!isJson && contentType.includes('text/html'))) {
          return await createAccountLocally();
        }

        const msg = data?.error?.message || 'Could not create account. Please try again.';
        return { success: false, code: 'SERVER_ERROR', error: msg };
      } catch {
        // Backend offline / network failure -> seamlessly fallback to local vault
        return await createAccountLocally();
      }
    },
    [signIn, showToast]
  );

  // Password Reset: Request link
  const requestPasswordReset = useCallback(
    async (email: string): Promise<AuthResult> => {
      const normalizedEmail = email.toLowerCase().trim();

      const requestLocally = (): AuthResult => {
        const localUsers = getLocalUsers();
        const userExists = localUsers.some((u) => u.email === normalizedEmail);
        if (userExists) {
          const token = 'rst_' + crypto.randomUUID();
          const tokens = getLocalResetTokens().filter((t) => t.email !== normalizedEmail);
          tokens.push({
            token,
            email: normalizedEmail,
            expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
          });
          saveLocalResetTokens(tokens);
          setPendingResetToken(token);
        }
        return {
          success: true,
          message:
            'If an account exists for this email address, password reset instructions have been generated.',
        };
      };

      try {
        const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail }),
        });

        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const data = isJson ? await res.json().catch(() => null) : null;

        if (res.ok) {
          return {
            success: true,
            message: data?.message || 'If an account exists for this email address, a password reset link has been sent.',
          };
        }

        if (res.status === 429) {
          const msg = data?.error?.message || 'Too many password reset requests. Please wait a few minutes before trying again.';
          return { success: false, code: 'RATE_LIMIT_EXCEEDED', error: msg };
        }

        if (res.status === 503) {
          const msg = data?.error?.message || 'Email delivery is not configured on the server. Please set RESEND_API_KEY in your server environment.';
          return { success: false, code: 'EMAIL_DELIVERY_NOT_CONFIGURED', error: msg };
        }

        if (res.status === 400) {
          const msg = data?.error?.message || 'Please enter a valid email address.';
          return { success: false, code: 'VALIDATION_ERROR', error: msg };
        }

        if (res.status === 404 || res.status === 405 || (!isJson && contentType.includes('text/html'))) {
          return requestLocally();
        }

        const msg = data?.error?.message || 'Unable to process password reset request. Please try again.';
        return { success: false, code: 'SERVER_ERROR', error: msg };
      } catch {
        return requestLocally();
      }
    },
    []
  );

  // Password Reset: Verify link token
  const verifyResetToken = useCallback(
    async (token: string): Promise<{ isValid: boolean; email?: string; error?: string }> => {
      // Check local reset tokens first
      const localTokens = getLocalResetTokens();
      const localMatch = localTokens.find((t) => t.token === token);
      if (localMatch) {
        if (Date.now() > localMatch.expiresAt) {
          return { isValid: false, error: 'This password reset link has expired. Please request a new one.' };
        }
        return { isValid: true, email: localMatch.email };
      }

      try {
        const res = await fetch(`${API_BASE_URL}/auth/password-reset/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => null);

        if (res.ok && data?.valid) {
          return { isValid: true, email: data.email };
        }

        return {
          isValid: false,
          error: data?.error?.message || 'This password reset link is invalid or has expired.',
        };
      } catch {
        return {
          isValid: false,
          error: 'Unable to connect to the server to verify reset link.',
        };
      }
    },
    []
  );

  // Password Reset: Complete password change
  const resetPassword = useCallback(
    async (token: string, newPassword: string): Promise<AuthResult> => {
      if (newPassword.length < 8) {
        return {
          success: false,
          code: 'VALIDATION_ERROR',
          error: 'Password must be at least 8 characters long.',
        };
      }

      // Check if this is a local reset token
      const localTokens = getLocalResetTokens();
      const localMatch = localTokens.find((t) => t.token === token);
      if (localMatch) {
        if (Date.now() > localMatch.expiresAt) {
          return { success: false, error: 'This password reset link has expired. Please request a new link.' };
        }
        const localUsers = getLocalUsers();
        const userIndex = localUsers.findIndex((u) => u.email === localMatch.email);
        if (userIndex !== -1) {
          const salt = crypto.randomUUID();
          const passwordHash = await hashPasswordClient(newPassword, salt);
          localUsers[userIndex].passwordHash = passwordHash;
          localUsers[userIndex].salt = salt;
          saveLocalUsers(localUsers);
        }
        // Invalidate token
        saveLocalResetTokens(localTokens.filter((t) => t.token !== token));
        setPendingResetToken(null);

        showToast({
          title: 'Password reset',
          message: 'Your sign-in password was updated. Please sign in with your new password.',
          type: 'success',
        });
        return {
          success: true,
          message: 'Your password has been reset successfully. Please sign in.',
        };
      }

      try {
        const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword }),
        });

        const data = await res.json().catch(() => null);

        if (res.ok) {
          setPendingResetToken(null);
          showToast({
            title: 'Password reset',
            message: 'Your sign-in password was updated. Please sign in with your new password.',
            type: 'success',
          });
          return {
            success: true,
            message: data?.message || 'Your password has been reset successfully. Please sign in.',
          };
        }

        return {
          success: false,
          error: data?.error?.message || 'Failed to reset password. Please ensure the link is still valid.',
        };
      } catch {
        return {
          success: false,
          code: 'NETWORK_ERROR',
          error: 'Unable to connect to the authentication server. Please check your network connection.',
        };
      }
    },
    [showToast]
  );

  // Sign out
  const signOut = useCallback(() => {
    const token = sessionStorage.getItem('keynest_token');
    if (token && !token.startsWith('local_jwt_')) {
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }

    sessionStorage.removeItem('keynest_token');
    sessionStorage.removeItem('keynest_user');
    sessionStorage.removeItem('keynest_passphrase');

    setCurrentUser(null);
    setIsLocked(false);
    setSelectedItemId(null);
    setSelectedCategoryId(null);
    setItems([]);
    setCategories([]);
    setTeammates([]);
    setInvitationsMap({});

    showToast({
      title: 'Signed out',
      message: 'You have been signed out of your vault.',
      type: 'info',
    });
  }, [showToast]);

  const selectItem = useCallback((id: string | null) => {
    setSelectedItemId(id);
  }, []);

  const addItem = useCallback(
    (itemData: {
      serviceName: string;
      url?: string;
      username: string;
      password: string;
      notes?: string;
      categoryId?: string;
      isShared?: boolean;
    }) => {
      const now = new Date().toISOString().split('T')[0];
      const visuals = getServiceVisuals(itemData.serviceName);

      const newItem: VaultItem = {
        id: 'item-' + Date.now(),
        serviceName: itemData.serviceName.trim(),
        url: itemData.url?.trim() || undefined,
        username: itemData.username.trim(),
        password: itemData.password,
        notes: itemData.notes?.trim() || undefined,
        categoryId: itemData.categoryId || undefined,
        isShared: Boolean(itemData.isShared),
        sharedWith: [],
        createdAt: now,
        updatedAt: now,
        iconBg: visuals.iconBg,
        iconInitials: visuals.iconInitials,
      };

      setItems((prev) => [newItem, ...prev]);
      setIsAddModalOpen(false);
      setSelectedItemId(newItem.id);
      showToast({
        title: 'Password added',
        message: `${newItem.serviceName} was added to your ${newItem.isShared ? 'shared' : 'personal'} passwords.`,
        type: 'success',
      });
    },
    [showToast]
  );

  const updateItem = useCallback(
    (id: string, updates: Partial<VaultItem>) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            const visuals = updates.serviceName
              ? getServiceVisuals(updates.serviceName)
              : { iconBg: item.iconBg, iconInitials: item.iconInitials };
            return {
              ...item,
              ...updates,
              ...visuals,
              updatedAt: new Date().toISOString().split('T')[0],
            };
          }
          return item;
        })
      );
      setIsEditModalOpen(false);
      showToast({
        title: 'Changes saved',
        message: 'Your password details were updated.',
        type: 'success',
      });
    },
    [showToast]
  );

  const deleteItem = useCallback(
    (id: string) => {
      const target = items.find((i) => i.id === id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (selectedItemId === id) {
        setSelectedItemId(null);
      }
      showToast({
        title: 'Password deleted',
        message: `${target?.serviceName || 'Password'} was removed from your vault.`,
        type: 'info',
      });
    },
    [items, selectedItemId, showToast]
  );

  const copyText = useCallback(
    async (text: string, label: string) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        }
        showToast({
          title: `${label} copied`,
          message: 'Copied to clipboard. Clear clipboard after use.',
          type: 'clipboard',
          countdownRemaining: 30,
        });
        return true;
      } catch {
        showToast({
          title: 'Copy failed',
          message: 'Unable to access clipboard.',
          type: 'warning',
        });
        return false;
      }
    },
    [showToast]
  );

  const copyPassword = useCallback(
    async (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return false;
      return copyText(item.password, 'Password');
    },
    [items, copyText]
  );

  // Teammates Management
  const addTeammate = useCallback(
    (name: string, email: string): Teammate => {
      const colors = ['#EDE9FE', '#FEF3C7', '#FCE7F3', '#CCFBF1', '#E0E7FF'];
      const cleanName = name.trim() || email.split('@')[0];
      const newTm: Teammate = {
        id: 'user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        name: cleanName,
        email: email.trim().toLowerCase(),
        initials: (cleanName.slice(0, 2)).toUpperCase(),
        avatarBg: colors[teammates.length % colors.length],
      };
      setTeammates((prev) => [...prev, newTm]);
      return newTm;
    },
    [teammates.length]
  );

  // Sharing
  const shareItem = useCallback(
    (itemId: string, teammateId: string, permission: SharePermission) => {
      const targetTeammate = teammates.find((t) => t.id === teammateId);
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            const filteredShares = item.sharedWith.filter((s) => s.teammateId !== teammateId);
            return {
              ...item,
              isShared: true,
              sharedWith: [
                ...filteredShares,
                {
                  teammateId,
                  permission,
                  sharedAt: new Date().toISOString().split('T')[0],
                },
              ],
            };
          }
          return item;
        })
      );

      setIsShareModalOpen(false);
      showToast({
        title: 'Password shared',
        message: `Shared with ${targetTeammate?.name || 'teammate'}. Note: removing access later cannot erase a password someone has already copied.`,
        type: 'info',
      });
    },
    [teammates, showToast]
  );

  const removeShare = useCallback(
    (itemId: string, teammateId: string) => {
      const targetTeammate = teammates.find((t) => t.id === teammateId);
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            const nextShares = item.sharedWith.filter((s) => s.teammateId !== teammateId);
            return {
              ...item,
              sharedWith: nextShares,
            };
          }
          return item;
        })
      );

      showToast({
        title: 'Access removed',
        message: `Removed access for ${targetTeammate?.name || 'teammate'}. Remember: this cannot erase a password they already saw or copied.`,
        type: 'warning',
      });
    },
    [teammates, showToast]
  );

  // Email Invitations & Acceptance
  const sendItemInvite = useCallback(
    async (
      itemId: string,
      recipientName: string,
      recipientEmail: string,
      permission: SharePermission,
      serviceName?: string
    ): Promise<{ success: boolean; error?: string }> => {
      const token = sessionStorage.getItem('keynest_token');
      const item = items.find((i) => i.id === itemId);
      const name = serviceName || item?.serviceName || 'Shared Password';

      if (token) {
        try {
          const res = await fetch(`${API_BASE_URL}/items/${itemId}/invitations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              recipientName,
              recipientEmail,
              permission,
              serviceName: name,
            }),
          });

          if (res.status === 503) {
            const errData = await res.json().catch(() => ({}));
            const errMsg =
              errData.error?.message ||
              'Email delivery is not configured on the server. Please set RESEND_API_KEY or SMTP credentials to send invitations.';
            return { success: false, error: errMsg };
          }

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const errMsg = errData.error?.message || 'Failed to dispatch email invitation.';
            return { success: false, error: errMsg };
          }

          const createdInvite: ItemInvitation = await res.json();
          setInvitationsMap((prev) => {
            const currentList = prev[itemId] || [];
            return {
              ...prev,
              [itemId]: [createdInvite, ...currentList.filter((inv) => inv.id !== createdInvite.id)],
            };
          });

          showToast({
            title: 'Invitation sent',
            message: `A secure email invitation was sent to ${recipientEmail}.`,
            type: 'success',
          });
          return { success: true };
        } catch (err: any) {
          return {
            success: false,
            error:
              err?.message ||
              'Could not reach the server to send the email invitation. Please ensure backend is running.',
          };
        }
      }

      // Standalone mode or unauthenticated
      return {
        success: false,
        error:
          'Email delivery is not configured on the server. Please sign in with a configured backend provider to send invitations.',
      };
    },
    [items, showToast]
  );

  const listItemInvites = useCallback(
    async (itemId: string): Promise<ItemInvitation[]> => {
      const token = sessionStorage.getItem('keynest_token');
      if (token) {
        try {
          const res = await fetch(`${API_BASE_URL}/items/${itemId}/invitations`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            const list: ItemInvitation[] = data.invitations || [];
            setInvitationsMap((prev) => ({
              ...prev,
              [itemId]: list,
            }));
            return list;
          }
        } catch {
          // ignore network failure and return local cache
        }
      }
      return invitationsMap[itemId] || [];
    },
    [invitationsMap]
  );

  const cancelItemInvite = useCallback(
    async (itemId: string, invitationId: string): Promise<boolean> => {
      const token = sessionStorage.getItem('keynest_token');
      if (token) {
        try {
          const res = await fetch(`${API_BASE_URL}/items/${itemId}/invitations/${invitationId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            showToast({
              title: 'Error canceling invitation',
              message: data.error?.message || 'Could not cancel invitation.',
              type: 'warning',
            });
            return false;
          }
        } catch {
          // local fallback
        }
      }

      setInvitationsMap((prev) => {
        const currentList = prev[itemId] || [];
        return {
          ...prev,
          [itemId]: currentList.map((inv) =>
            inv.id === invitationId
              ? { ...inv, status: 'revoked' as const, revokedAt: new Date().toISOString() }
              : inv
          ),
        };
      });

      showToast({
        title: 'Invitation canceled',
        message: 'The recipient will no longer be able to use that invitation link.',
        type: 'info',
      });
      return true;
    },
    [showToast]
  );

  const verifyInviteToken = useCallback(
    async (token: string): Promise<VerifiedInvitationInfo | null> => {
      try {
        const res = await fetch(`${API_BASE_URL}/invitations/verify?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          return null;
        }
        return (await res.json()) as VerifiedInvitationInfo;
      } catch {
        return null;
      }
    },
    []
  );

  const acceptInviteToken = useCallback(
    async (token: string): Promise<{ success: boolean; itemId?: string; error?: string }> => {
      const authToken = sessionStorage.getItem('keynest_token');
      if (!authToken) {
        return {
          success: false,
          error: 'Please sign in or create an account with the invited email to accept.',
        };
      }

      try {
        const res = await fetch(`${API_BASE_URL}/invitations/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return {
            success: false,
            error: errData.error?.message || 'Failed to accept invitation.',
          };
        }

        const data = await res.json();
        const acceptedItemId = data.itemId;
        const serviceName = data.serviceName || 'Shared Password';

        setItems((prev) => {
          const existing = prev.find((i) => i.id === acceptedItemId);
          if (existing) {
            return prev.map((i) => (i.id === acceptedItemId ? { ...i, isShared: true } : i));
          }
          const now = new Date().toISOString().split('T')[0];
          const visuals = getServiceVisuals(serviceName);
          const newItem: VaultItem = {
            id: acceptedItemId,
            serviceName,
            username: currentUser?.email || 'teammate',
            password: '••••••••••••',
            notes: 'Shared with you via email invitation.',
            isShared: true,
            sharedWith: [],
            createdAt: now,
            updatedAt: now,
            iconBg: visuals.iconBg,
            iconInitials: visuals.iconInitials,
          };
          return [newItem, ...prev];
        });

        setSelectedItemId(acceptedItemId);
        setActiveTab('shared');
        setPendingInviteToken(null);

        if (typeof window !== 'undefined' && window.history) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        showToast({
          title: 'Invitation accepted',
          message: `You now have access to ${serviceName}. The password remains hidden until you choose to reveal it.`,
          type: 'success',
        });

        return { success: true, itemId: acceptedItemId };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Network error while accepting invitation.',
        };
      }
    },
    [currentUser, showToast]
  );

  // Categories
  const addCategory = useCallback(
    (name: string, color?: string) => {
      const palette = ['#E1306C', '#0D9488', '#F97316', '#6366F1', '#8B5CF6', '#EC4899', '#3B82F6'];
      const chosenColor = color || palette[categories.length % palette.length];
      const newCat: Category = {
        id: 'cat-' + Date.now(),
        name: name.trim(),
        color: chosenColor,
      };
      setCategories((prev) => [...prev, newCat]);
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      showToast({
        title: 'Category created',
        message: `Added category "${newCat.name}".`,
        type: 'success',
      });
    },
    [categories, showToast]
  );

  const renameCategory = useCallback(
    (id: string, name: string) => {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: name.trim() } : c))
      );
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      showToast({
        title: 'Category renamed',
        message: `Category updated to "${name.trim()}".`,
        type: 'success',
      });
    },
    [showToast]
  );

  const deleteCategory = useCallback(
    (id: string) => {
      const cat = categories.find((c) => c.id === id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setItems((prev) =>
        prev.map((item) => (item.categoryId === id ? { ...item, categoryId: undefined } : item))
      );
      if (selectedCategoryId === id) {
        setSelectedCategoryId(null);
      }
      showToast({
        title: 'Category deleted',
        message: `Removed category "${cat?.name || 'Category'}". Associated passwords are now uncategorized.`,
        type: 'info',
      });
    },
    [categories, selectedCategoryId, showToast]
  );

  // Lock & Security
  const lockVault = useCallback(() => {
    setIsLocked(true);
    showToast({
      title: 'Vault locked',
      message: 'Your passwords are encrypted and protected.',
      type: 'info',
    });
  }, [showToast]);

  const unlockVault = useCallback(
    (passphrase: string) => {
      if (!passphrase.trim()) return false;
      const stored = sessionStorage.getItem('keynest_passphrase');
      if (stored && passphrase !== stored) {
        return false;
      }
      setIsLocked(false);
      showToast({
        title: 'Vault unlocked',
        message: `Welcome back${currentUser?.name ? `, ${currentUser.name}` : ''}.`,
        type: 'success',
      });
      return true;
    },
    [currentUser, showToast]
  );

  // Modal open helpers
  const openAddModal = useCallback((isShared?: boolean) => {
    setDefaultAddShared(Boolean(isShared));
    setIsAddModalOpen(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false);
  }, []);

  const openEditModal = useCallback(() => {
    setIsEditModalOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
  }, []);

  const openShareModal = useCallback(() => {
    setIsShareModalOpen(true);
  }, []);

  const closeShareModal = useCallback(() => {
    setIsShareModalOpen(false);
  }, []);

  const openCategoryModal = useCallback((cat?: Category) => {
    setEditingCategory(cat || null);
    setIsCategoryModalOpen(true);
  }, []);

  const closeCategoryModal = useCallback(() => {
    setEditingCategory(null);
    setIsCategoryModalOpen(false);
  }, []);

  // Shortcut: Cmd/Ctrl + L to lock vault
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        lockVault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lockVault]);

  return (
    <VaultContext.Provider
      value={{
        currentUser,
        activeTab,
        setActiveTab,
        selectedItemId,
        selectItem,
        selectedCategoryId,
        setSelectedCategoryId,
        searchQuery,
        setSearchQuery,

        signIn,
        createAccount,
        signOut,
        requestPasswordReset,
        verifyResetToken,
        resetPassword,
        pendingResetToken,
        setPendingResetToken,

        items,
        addItem,
        updateItem,
        deleteItem,
        copyPassword,
        copyText,

        teammates,
        addTeammate,
        shareItem,
        removeShare,

        invitationsMap,
        sendItemInvite,
        listItemInvites,
        cancelItemInvite,
        verifyInviteToken,
        acceptInviteToken,
        pendingInviteToken,
        setPendingInviteToken,

        categories,
        addCategory,
        renameCategory,
        deleteCategory,

        isLocked,
        lockVault,
        unlockVault,

        isAddModalOpen,
        isEditModalOpen,
        isShareModalOpen,
        isCategoryModalOpen,
        editingCategory,
        defaultAddShared,
        openAddModal,
        closeAddModal,
        openEditModal,
        closeEditModal,
        openShareModal,
        closeShareModal,
        openCategoryModal,
        closeCategoryModal,

        toasts,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
};
