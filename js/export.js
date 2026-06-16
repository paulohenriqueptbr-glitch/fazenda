const render = () => {
  renderClientPanel();
  renderPriceQuote();
  renderSummary();
  renderMilk();
  renderAnimals();
  renderBreeding();
  renderMedication();
  renderCropEvents();
  renderStockItems();
  renderAlerts();
  renderReports();
};

const exportDataBackup = () => {
  const pendingSyncCount = getSyncQueue().length;
  const backup = {
    exported_at: new Date().toISOString(),
    data: state,
    pending_sync_count: pendingSyncCount,
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

const printCurrentReport = () => {
  renderReports();
  document.body.classList.add("printing-report");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-report"), 400);
};
