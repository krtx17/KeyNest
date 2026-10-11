import React from 'react';
import { VaultProvider, useVault } from './context/VaultContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { VaultHome } from './components/VaultHome';
import { CredentialDetail } from './components/CredentialDetail';
import { CategoryView } from './components/CategoryView';
import { AddEditModal } from './components/AddEditModal';
import { ShareAccessModal } from './components/ShareAccessModal';
import { CategoryModal } from './components/CategoryModal';
import { AuthScreen } from './components/AuthScreen';
import { LockScreen } from './components/LockScreen';
import { ToastContainer } from './components/ToastContainer';

import { AcceptInviteModal } from './components/AcceptInviteModal';

const MainLayout: React.FC = () => {
  const { currentUser, isLocked, activeTab, selectedItemId } = useVault();

  // 1. Not signed in: show Sign in / Create account screen
  if (!currentUser) {
    return (
      <>
        <AuthScreen />
        <AcceptInviteModal />
        <ToastContainer />
      </>
    );
  }

  // 2. Vault is locked: prompt to unlock
  if (isLocked) {
    return (
      <>
        <LockScreen />
        <AcceptInviteModal />
        <ToastContainer />
      </>
    );
  }

  // 3. Vault is open: show main interface
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC]">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex shrink-0 h-full">
        <Sidebar />
      </div>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header />

        {/* Mobile Nav Header */}
        <MobileNav />

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          {selectedItemId ? (
            <CredentialDetail />
          ) : activeTab === 'categories' ? (
            <CategoryView />
          ) : (
            <VaultHome />
          )}
        </main>
      </div>

      {/* Modals & Overlays */}
      <AddEditModal />
      <ShareAccessModal />
      <CategoryModal />
      <AcceptInviteModal />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <VaultProvider>
      <MainLayout />
    </VaultProvider>
  );
}
