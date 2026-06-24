// UI helper for loading overlay
const LoadingOverlay = {
  show() {
    let overlay = document.getElementById('global-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'global-loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `<div class="loading-spinner"></div>`;
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  },
  hide() {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) overlay.style.display = 'none';
  }
};
