/* The Grimoire Home: presentation only. No permissions, data writes, or external calls. */
(() => {
  'use strict';
  const render = () => {
    const dateNode = document.getElementById('grimoire-date');
    const greetingNode = document.getElementById('grimoire-welcome');
    if (!dateNode && !greetingNode) return;
    const now = new Date();
    if (dateNode) {
      dateNode.textContent = new Intl.DateTimeFormat(undefined, {
        weekday: 'long', month: 'long', day: 'numeric'
      }).format(now);
      dateNode.setAttribute('datetime', [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
      ].join('-'));
    }
    if (greetingNode) {
      const hour = now.getHours();
      greetingNode.textContent = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.';
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
})();
