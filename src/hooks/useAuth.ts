// ============================================================
// HyLauncher — useAuth Hook
// ============================================================

import { useState, useEffect, useCallback } from "react";
import type { Account, DeviceCodeResponse } from "../lib/types";
import * as cmd from "../lib/tauri-commands";

interface AuthState {
  accounts: Account[];
  activeAccount: Account | null;
  isLoading: boolean;
  error: string | null;
  /** Microsoft device code flow state */
  deviceCode: DeviceCodeResponse | null;
  isPolling: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    accounts: [],
    activeAccount: null,
    isLoading: true,
    error: null,
    deviceCode: null,
    isPolling: false,
  });

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const [accounts, active] = await Promise.all([
        cmd.getAccounts(),
        cmd.getActiveAccount(),
      ]);
      setState((s) => ({
        ...s,
        accounts,
        activeAccount: active,
        isLoading: false,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: String(err),
        isLoading: false,
      }));
    }
  }, []);

  const loginOffline = useCallback(async (username: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const account = await cmd.loginOffline(username);
      await cmd.setActiveAccount(account.id);
      setState((s) => ({
        ...s,
        accounts: [...s.accounts.filter((a) => a.id !== account.id), account],
        activeAccount: account,
        isLoading: false,
      }));
      return account;
    } catch (err) {
      setState((s) => ({
        ...s,
        error: String(err),
        isLoading: false,
      }));
      return null;
    }
  }, []);

  const startMicrosoftLogin = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const deviceCode = await cmd.startMicrosoftLogin();
      setState((s) => ({
        ...s,
        deviceCode,
        isPolling: true,
        isLoading: false,
      }));

      // Start polling
      pollForAuth(deviceCode);
    } catch (err) {
      setState((s) => ({
        ...s,
        error: String(err),
        isLoading: false,
      }));
    }
  }, []);

  const pollForAuth = useCallback(async (dc: DeviceCodeResponse) => {
    try {
      const account = await cmd.pollMicrosoftLogin(dc.deviceCode);
      await cmd.setActiveAccount(account.id);
      setState((s) => ({
        ...s,
        accounts: [...s.accounts.filter((a) => a.id !== account.id), account],
        activeAccount: account,
        deviceCode: null,
        isPolling: false,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: String(err),
        deviceCode: null,
        isPolling: false,
      }));
    }
  }, []);

  const cancelMicrosoftLogin = useCallback(async () => {
    try {
      await cmd.cancelMicrosoftLogin();
    } catch {
      // ignore
    }
    setState((s) => ({
      ...s,
      deviceCode: null,
      isPolling: false,
    }));
  }, []);

  const removeAccount = useCallback(async (accountId: string) => {
    try {
      await cmd.removeAccount(accountId);
      setState((s) => ({
        ...s,
        accounts: s.accounts.filter((a) => a.id !== accountId),
        activeAccount:
          s.activeAccount?.id === accountId ? null : s.activeAccount,
      }));
    } catch (err) {
      setState((s) => ({ ...s, error: String(err) }));
    }
  }, []);

  const selectAccount = useCallback(async (accountId: string) => {
    try {
      await cmd.setActiveAccount(accountId);
      setState((s) => ({
        ...s,
        activeAccount: s.accounts.find((a) => a.id === accountId) ?? null,
      }));
    } catch (err) {
      setState((s) => ({ ...s, error: String(err) }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const logout = useCallback(async () => {
    if (state.activeAccount) {
      await removeAccount(state.activeAccount.id);
    }
  }, [state.activeAccount, removeAccount]);

  return {
    ...state,
    loginOffline,
    startMicrosoftLogin,
    cancelMicrosoftLogin,
    removeAccount,
    selectAccount,
    logout,
    clearError,
    reload: loadAccounts,
  };
}
