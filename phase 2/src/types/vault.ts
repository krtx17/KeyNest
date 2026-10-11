export type SharePermission = 'view_copy' | 'edit';

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Teammate {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarBg: string;
}

export interface ItemShare {
  teammateId: string;
  permission: SharePermission;
  sharedAt: string;
}

export interface VaultItem {
  id: string;
  serviceName: string;
  url?: string;
  username: string;
  password: string;
  notes?: string;
  categoryId?: string;
  isShared: boolean;
  sharedWith: ItemShare[];
  createdAt: string;
  updatedAt: string;
  iconBg?: string;
  iconInitials?: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  initials: string;
}

export interface ToastNotification {
  id: string;
  title: string;
  message?: string;
  type: 'info' | 'success' | 'warning';
}
