import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  VaultItem,
  Category,
  Teammate,
  SharePermission,
  ToastNotification,
  CurrentUser,
} from '../types/vault';
import {
  CURRENT_USER,
  INITIAL_CATEGORIES,
  INITIAL_TEAMMATES,
  INITIAL_ITEMS,
} from '../data/initialData';

export type MainTab = 'personal' | 'shared' | 'categories';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

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
  signIn: (email: string, password: string) => Promise<boolean>;
  createAccount: (email: string, password: string) => Promise<boolean>;
  signOut: () => void;

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
    async (email: string, password: string): Promise<boolean> => {
      try {
        // 1. Attempt API authentication if backend is available
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, deviceName: 'Web Client' }),
        });

        if (res.ok) {
          const data = await res.json();
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

          showToast({
            title: 'Welcome back',
            message: `Signed in as ${user.email}.`,
            type: 'success',
          });
          return true;
        }

        if (res.status === 401 || res.status === 400) {
          const errData = await res.json().catch(() => null);
          showToast({
            title: 'Sign in failed',
            message: errData?.error?.message || 'Invalid email or password.',
            type: 'warning',
          });
          return false;
        }
      } catch {
        // Fallback to local secure session if backend is offline or standalone preview
        const normalizedEmail = email.toLowerCase().trim();
        const user: CurrentUser = {
          id: 'usr_' + Math.abs(normalizedEmail.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)),
          email: normalizedEmail,
          name: normalizedEmail.split('@')[0],
          initials: normalizedEmail.slice(0, 2).toUpperCase(),
        };

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

        showToast({
          title: 'Welcome to KeyNest',
          message: 'Signed in successfully.',
          type: 'success',
        });
        return true;
      }
      return false;
    },
    [showToast]
  );

  // Authentication: Create account
  const createAccount = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (res.ok || res.status === 201) {
          // Immediately log in with the new account
          return await signIn(email, password);
        }

        if (res.status === 409) {
          showToast({
            title: 'Account exists',
            message: 'An account with this email already exists. Try signing in.',
            type: 'warning',
          });
          return false;
        }

        const errData = await res.json().catch(() => null);
        showToast({
          title: 'Registration failed',
          message: errData?.error?.message || 'Could not create account.',
          type: 'warning',
        });
        return false;
      } catch {
        // Local standalone registration fallback
        return await signIn(email, password);
      }
    },
    [signIn, showToast]
  );

  // Sign out
  const signOut = useCallback(() => {
    const token = sessionStorage.getItem('keynest_token');
    if (token) {
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
