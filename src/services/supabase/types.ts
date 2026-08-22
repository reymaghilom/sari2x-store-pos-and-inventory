export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'pending' | 'error' | 'unconfigured';

export type SyncDiagnostics = {
  status: SyncStatus;
  configured: boolean;
  online: boolean;
  deviceId: string;
  lastSuccessfulSync: string | null;
  pendingCount: number;
  failedCount: number;
  restoreNeedsCloudReconciliation: boolean;
  message: string;
};

export type SyncResult = {
  ok: boolean;
  status: SyncStatus;
  pushed: number;
  pulled: number;
  message: string;
};
