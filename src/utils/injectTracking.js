/* Injects an admin-supplied Google tracking snippet (gtag.js, GTM, Ads
   conversion event, etc.) into the live page. Scripts pasted as raw HTML
   don't execute via innerHTML, so each <script> is re-created manually. */
export function injectTrackingCode(html, key) {
  if (!html || !html.trim()) return;
  if (document.querySelector(`[data-tracking-key="${key}"]`)) return; // already injected

  const temp = document.createElement('div');
  temp.innerHTML = html;

  Array.from(temp.childNodes).forEach(node => {
    if (node.nodeName === 'SCRIPT') {
      const script = document.createElement('script');
      Array.from(node.attributes).forEach(attr => script.setAttribute(attr.name, attr.value));
      script.text = node.textContent;
      script.setAttribute('data-tracking-key', key);
      document.head.appendChild(script);
    } else if (node.nodeType === 1) {
      node.setAttribute('data-tracking-key', key);
      document.body.insertBefore(node, document.body.firstChild);
    }
  });
}
