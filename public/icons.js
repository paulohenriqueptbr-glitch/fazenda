if (window.lucide) {
  window.lucide.createIcons();
}

// Re-run after DOM fully ready and after dynamic renders
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) window.lucide.createIcons();
});
