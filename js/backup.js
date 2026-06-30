import { state, todayIso, userStorageKey } from "./state.js";
import { getSyncQueue } from "./sync.js";
import { showToast } from "./ui.js";
import { warn } from "./logger.js";

const AUTO_BACKUP_KEY = "terrasyn_last_auto_backup";
const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export const maybeAutoBackup = () => {
  try {
    const last = localStorage.getItem(userStorageKey(AUTO_BACKUP_KEY));
    const now = Date.now();
    if (last && now - Number(last) < BACKUP_INTERVAL_MS) return;

    const backup = {
      exported_at: new Date().toISOString(),
      auto: true,
      data: {
        milk: state.milk,
        animals: state.animals,
        lactations: state.lactations,
        breeding: state.breeding,
        medication: state.medication,
        cropEvents: state.cropEvents,
        stockItems: state.stockItems,
        reminders: state.reminders,
        priceQuote: state.priceQuote,
      },
      pending_sync_count: getSyncQueue().length,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `terrasyn-autobackup-${todayIso()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    localStorage.setItem(userStorageKey(AUTO_BACKUP_KEY), String(now));
    showToast("Backup automático semanal gerado", "sync");
  } catch (err) { warn("Auto-backup falhou:", err); }
};

export const exportDataBackup = () => {
  const backup = {
    exported_at: new Date().toISOString(),
    data: state,
    pending_sync_count: getSyncQueue().length,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `terrasyn-backup-${todayIso()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Backup exportado com sucesso!");
};

export default {
  maybeAutoBackup,
  exportDataBackup,
};
