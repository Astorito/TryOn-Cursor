(function() {
  'use strict';

  // Configuration
  const API_KEY = document.currentScript.dataset.tryonKey;
  const scriptSrc = document.currentScript.src;
  const BACKEND_URL = scriptSrc.substring(0, scriptSrc.indexOf('/api/'));
  const WIDGET_ID = 'tryon-widget-' + Math.random().toString(36).substring(2, 9);

  // State management
  const state = {
    isOpen: false,
    userImage: null,
    userImageFile: null,
    garments: [null, null, null],
    garmentFiles: [null, null, null],
    isGenerating: false,
    uploadedUrls: {},  // cache: base64 hash -> FAL url
    resultUrl: null,
    error: null,
    currentLoadingPhase: 0,
    loadingProgress: 0
  };

  // DOM elements
  let container, fab, panel, overlay, loadingOverlay;

  const TRYON_SVG = {
    uploadCam: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="1"/><circle cx="12" cy="13" r="3"/><path d="M8 6V4h8v2"/></svg>',
    capture: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2F3C4F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>',
    garment0: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3L3 8V21H21V8L18 3H6Z"/><path d="M3 8H21"/><path d="M16 11C16 13.2091 14.2091 15 12 15C9.79086 15 8 13.2091 8 11"/></svg>',
    garment1: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4L12 2L4 4V7L12 9L20 7V4Z"/><path d="M12 9V22"/><path d="M4 7V18L12 22L20 18V7"/></svg>',
    garment2: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L7 4L3 9L12 22L21 9L17 4L12 2Z"/><path d="M7 4L12 9L17 4"/><path d="M3 9H21"/></svg>'
  };

  // Layout configuration
  const layoutConfig = {
    panelWidth: 320,
    panelTotalHeight: 540,
    headerHeight: 55,
    footerHeight: 70,
    horizontalPadding: 20,
    verticalGap: 12,
    userBoxHeight: 180,
    garmentBoxSize: 85
  };

  // Helper function to query shadow DOM
  function shadowQuerySelector(selector) {
    return container._shadowRoot.querySelector(selector);
  }

  // Return fixed box sizes
  function calculateBoxSizes() {
    const userBoxWidth = layoutConfig.panelWidth - (layoutConfig.horizontalPadding * 2);
    return {
      userBoxWidth: userBoxWidth,
      userBoxHeight: layoutConfig.userBoxHeight,
      garmentBoxSize: layoutConfig.garmentBoxSize,
      panelHeight: layoutConfig.panelTotalHeight
    };
  }

  // Loading phases
  const loadingPhases = [
    { text: 'Scanning your look',     description: 'Analyzing your photo...', duration: 4000 },
    { text: 'Picking up the garment', description: 'Identifying fabric, color & fit...', duration: 5000 },
    { text: 'Getting dressed',        description: 'AI is putting the outfit on you...', duration: 6000 },
    { text: 'Almost ready',           description: 'Adding final details...', duration: Infinity }
  ];

  // Image compression
  function compressImage(base64, maxDimension, quality) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var w = img.width, h = img.height;
        // Scale down preserving aspect ratio — only if needed
        if (w > maxDimension || h > maxDimension) {
          if (w > h) { h = Math.round(h * maxDimension / w); w = maxDimension; }
          else { w = Math.round(w * maxDimension / h); h = maxDimension; }
        }
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = base64;
    });
  }

  // Pre-upload image to FAL storage in background
  function preUploadImage(base64, cacheKey) {
    if (state.uploadedUrls[cacheKey]) return; // already uploaded
    state.uploadedUrls[cacheKey] = 'pending';
    fetch(BACKEND_URL + '/api/images/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        state.uploadedUrls[cacheKey] = data.url;
        console.log('[TryOn] Pre-uploaded:', cacheKey.substring(0, 20), '->', data.url.substring(0, 50));
      } else {
        delete state.uploadedUrls[cacheKey];
      }
    })
    .catch(() => { delete state.uploadedUrls[cacheKey]; });
  }

  // Get cached URL or return original base64
  function getImageUrl(base64) {
    if (!base64) return base64;
    var key = base64.substring(0, 100);
    var cached = state.uploadedUrls[key];
    if (cached && cached !== 'pending') return cached;
    return base64; // fallback to base64 if not ready
  }

  function init() {
    if (!API_KEY) {
      console.error('TryOn: API key required in data-tryon-key attribute');
      return;
    }

    console.log('🎨 TryOn Widget initializing with key:', API_KEY.substring(0, 10) + '...');

    createElements();
    attachStyles();
    attachEvents();
  }

  function createElements() {
    container = document.createElement('div');
    container.id = WIDGET_ID;
    container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 2147483647; pointer-events: none;';
    document.body.appendChild(container);

    var shadow = container.attachShadow({ mode: 'open' });

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'all: initial; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
    shadow.appendChild(wrapper);

    fab = document.createElement('button');
    // Círculo #222 con estrellas #FAF9F3 (8 puntas) - diseño del usuario
    fab.innerHTML = `<svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="28" r="28" fill="#222"/><path d="M50 0 L61 39 L100 50 L61 61 L50 100 L39 61 L0 50 L39 39 Z" fill="#FAF9F3" transform="translate(36, 21) scale(0.221) translate(-50, -50)"/><path d="M50 0 L61 39 L100 50 L61 61 L50 100 L39 61 L0 50 L39 39 Z" fill="#FAF9F3" transform="translate(24, 40) scale(0.123) translate(-50, -50)"/><path d="M50 0 L61 39 L100 50 L61 61 L50 100 L39 61 L0 50 L39 39 Z" fill="#FAF9F3" transform="translate(12, 31) scale(0.077) translate(-50, -50)"/></svg>`;
    fab.style.cssText = 'position: fixed; bottom: 24px; right: 24px; background: transparent; border: none; border-radius: 50%; width: 56px; height: 56px; cursor: pointer; box-shadow: 0 0 10px rgba(0,0,0,0.5); transition: transform 0.2s, box-shadow 0.2s; pointer-events: auto; display: flex; align-items: center; justify-content: center; padding: 0;';
    fab.onmouseover = () => { fab.style.transform = 'scale(1.08)'; fab.style.boxShadow = '0 0 14px rgba(0,0,0,0.6)'; };
    fab.onmouseout = () => { fab.style.transform = 'scale(1)'; fab.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)'; };
    wrapper.appendChild(fab);

    overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: transparent; display: none; pointer-events: none;';
    wrapper.appendChild(overlay);

    panel = document.createElement('div');
    panel.style.cssText = 'position: fixed; bottom: 82px; right: 24px; width: ' + layoutConfig.panelWidth + 'px; height: ' + layoutConfig.panelTotalHeight + 'px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 4px 30px rgba(0,0,0,0.05); display: none; overflow: hidden; flex-direction: column; transition: height 0.4s ease; pointer-events: auto; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
    wrapper.appendChild(panel);

    loadingOverlay = document.createElement('div');
    loadingOverlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.98); z-index: 10; display: none; flex-direction: column; justify-content: center; align-items: center; pointer-events: auto;';
    panel.appendChild(loadingOverlay);

    container._shadowRoot = shadow;
    container._wrapper = wrapper;

    renderPanel();
  }

  function attachStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');

      * {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .tryon-heading-serif {
        font-family: 'Playfair Display', Georgia, serif;
        font-weight: 600;
        color: #2F3C4F;
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.9; }
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes slideIn {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes twinkle {
        0%, 100% { opacity: 0.3; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.2); }
      }

      .tryon-upload-box {
        border: 1px dashed #E5E7EB;
        border-radius: 6px;
        padding: 12px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
        background: #F8F9FA;
        position: relative;
      }

      .tryon-upload-box:hover {
        border-color: #2F3C4F;
        background: #F8F9FA;
        transform: translateY(-1px);
      }

      .tryon-upload-box.has-image {
        border-color: #10b981;
        background: #f0fdf4;
        padding: 8px;
      }

      .tryon-upload-box .preview {
        position: relative;
        width: 100%;
        height: 120px;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .tryon-upload-box .preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .tryon-upload-box .remove-btn {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(0,0,0,0.7);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        line-height: 1;
      }

      .tryon-upload-icon {
        width: 36px;
        height: 36px;
        margin: 0 auto 6px;
        opacity: 0.6;
      }

      .tryon-upload-text {
        font-size: 14px;
        font-weight: 600;
        color: #2F3C4F;
        margin-bottom: 2px;
        letter-spacing: 0.02em;
      }

      .tryon-upload-hint {
        font-size: 9px;
        font-weight: 700;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.15em;
      }

      .tryon-section-title {
        font-size: 16px;
        font-weight: 600;
        color: #2F3C4F;
        margin-bottom: 6px;
        font-family: 'Playfair Display', Georgia, serif;
      }

      .tryon-garments-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-bottom: 12px;
      }

      .tryon-garment-box {
        aspect-ratio: 1;
        border: 1px solid #E5E7EB;
        border-radius: 6px;
        background: #F8F9FA;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 6px;
        position: relative;
        max-height: 80px;
      }

      .tryon-garment-box:hover {
        border-color: #2F3C4F;
        background: #F8F9FA;
      }

      .tryon-garment-box.has-image {
        border-color: #10b981;
        background: #f0fdf4;
        padding: 4px;
      }

      .tryon-garment-icon {
        width: 28px;
        height: 28px;
        margin-bottom: 2px;
        opacity: 0.6;
      }

      .tryon-submit-btn {
        width: 100%;
        height: 48px;
        background: #2F3C4F;
        color: white;
        border: none;
        border-radius: 6px;
        font-weight: 700;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.25em;
        cursor: pointer;
        transition: background 0.2s, transform 0.2s;
        margin-top: 0;
        flex-shrink: 0;
        font-family: 'Inter', sans-serif;
      }

      .tryon-submit-btn:hover:not(:disabled) {
        background: #000;
        transform: translateY(-1px);
      }

      .tryon-submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .tryon-loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255,255,255,0.98);
        z-index: 10;
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 24px;
      }

      .tryon-loading-icon {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: radial-gradient(circle, #e2e8f0 0%, #F8F9FA 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 24px;
        animation: pulse 2s infinite;
        box-shadow: 0 8px 24px rgba(47,60,79,0.08);
      }

      .tryon-loading-text {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 20px;
        font-weight: 600;
        color: #2F3C4F;
        margin-bottom: 8px;
        animation: fadeIn 0.5s ease;
      }

      .tryon-loading-desc {
        font-size: 14px;
        color: #64748b;
        text-align: center;
        line-height: 1.6;
        max-width: 280px;
        animation: fadeIn 0.5s ease 0.2s both;
      }

      .tryon-progress-container {
        position: absolute;
        bottom: 24px;
        left: 24px;
        right: 24px;
      }

      .tryon-progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .tryon-progress-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #94a3b8;
      }

      .tryon-progress-percent {
        font-size: 10px;
        font-weight: 700;
        color: #64748b;
      }

      .tryon-progress-bar {
        width: 100%;
        height: 6px;
        background: #e2e8f0;
        border-radius: 999px;
        overflow: hidden;
      }

      .tryon-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #2F3C4F, #6D5ED2);
        border-radius: 999px;
        transition: width 0.5s ease;
      }

      .tryon-result-image-container {
        position: relative;
        width: 100%;
        min-height: 60vh;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .tryon-result-image {
        width: 100%;
        max-height: calc(100vh - 180px);
        object-fit: contain;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        transition: transform 0.1s ease;
        cursor: zoom-in;
        transform-origin: center center;
      }

      .tryon-result-image.zoomed {
        transform: scale(2);
        cursor: zoom-out;
      }

      .tryon-close-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(0,0,0,0.7);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        line-height: 1;
        z-index: 15;
        backdrop-filter: blur(4px);
        transition: background 0.2s;
      }

      .tryon-close-btn:hover {
        background: rgba(0,0,0,0.85);
      }

      .tryon-images-used {
        margin-top: 8px;
        padding-top: 12px;
        border-top: 1px solid #e5e7eb;
        flex-shrink: 0;
      }

      .tryon-images-used-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #94a3b8;
        margin-bottom: 8px;
        text-align: center;
      }

      .tryon-thumbnails {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-bottom: 12px;
      }

      .tryon-thumbnail {
        width: 60px;
        height: 60px;
        border-radius: 10px;
        border: 2px solid #e5e7eb;
        overflow: hidden;
        background: #f8fafc;
      }

      .tryon-thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .tryon-try-again-btn {
        width: 100%;
        height: 48px;
        background: #2F3C4F;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 20px rgba(47,60,79,0.15);
        font-family: 'Inter', sans-serif;
      }

      .tryon-try-again-btn:hover {
        background: #000;
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      }

      .tryon-loading-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 40px;
      }

      .tryon-remove-btn {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(0,0,0,0.7);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        line-height: 1;
        backdrop-filter: blur(4px);
        transition: background 0.2s;
      }

      @keyframes tryon-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }

      .tryon-remove-btn:hover {
        background: rgba(0,0,0,0.85);
      }

      .tryon-add-more {
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border: 2px dashed #d1d5db !important;
        background: white !important;
        color: #9ca3af;
        font-size: 32px;
        font-weight: 300;
        transition: all 0.2s;
      }

      .tryon-add-more:hover {
        border-color: #2F3C4F !important;
        color: #2F3C4F;
      }

      .tryon-close-panel-btn:hover {
        color: #2F3C4F !important;
      }

      .tryon-capture-btn:hover {
        background: #fff !important;
        border-color: #2F3C4F !important;
      }
    `;
    container._shadowRoot.appendChild(style);
  }

  function attachEvents() {
    fab.onclick = togglePanel;
  }

  function togglePanel() {
    if (state.isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function openPanel() {
    state.isOpen = true;
    overlay.style.display = 'block';
    panel.style.display = 'flex';
    panel.style.animation = 'slideIn 0.3s ease';
    setTimeout(() => setupFileInputs(), 0);
  }

  function closePanel() {
    state.isOpen = false;
    overlay.style.display = 'none';
    panel.style.display = 'none';
    panel.style.height = layoutConfig.panelTotalHeight + 'px';
  }

  function renderPanel() {
    const sizes = calculateBoxSizes();

    const svgHouse = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2F3C4F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L4 9v12h16V9l-8-6z"/><path d="M12 3v18"/></svg>';
    const svgClose = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M6 6l12 12"/></svg>';

    panel.innerHTML = `
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px ${layoutConfig.horizontalPadding}px; flex-shrink: 0; border-bottom: 1px solid #f3f4f6; box-sizing: border-box;">
        <span style="font-size: 10px; color: #2F3C4F; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; display: flex; align-items: center; gap: 10px;">
          ${svgHouse}
          trylook-ai.com
        </span>
        <button class="close-panel-btn tryon-close-panel-btn" style="background: none; border: none; cursor: pointer; color: #94a3b8; padding: 4px; line-height: 1; display: flex; align-items: center; justify-content: center; transition: color 0.2s;" title="Close panel" aria-label="Close">${svgClose}</button>
      </div>

      <!-- Content -->
      <div style="flex: 1; display: flex; flex-direction: column; padding: 20px ${layoutConfig.horizontalPadding}px; gap: 20px; overflow: hidden; box-sizing: border-box;">
        <section style="flex-shrink: 0;">
          <h2 class="tryon-heading-serif" style="font-size: 16px; margin: 0 0 14px 0;">Upload your picture</h2>
          <div id="user-upload" class="tryon-upload-box" style="width: ${sizes.userBoxWidth}px; height: ${sizes.userBoxHeight}px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;">
            <div style="margin-bottom: 16px; color: #94a3b8;">${TRYON_SVG.uploadCam}</div>
            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #2F3C4F; letter-spacing: 0.02em;">Upload a portrait</p>
            <p style="margin: 0 0 20px 0; font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.15em;">Drag &amp; Drop or Browse</p>
            <button id="open-camera-btn" class="tryon-capture-btn" style="background: white; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px 22px; font-size: 10px; font-weight: 700; color: #2F3C4F; text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;" onclick="event.stopPropagation()">
              ${TRYON_SVG.capture}
              Capture Live
            </button>
          </div>
        </section>

        <section style="flex-shrink: 0;">
          <h2 class="tryon-heading-serif" style="font-size: 16px; margin: 0 0 10px 0;">Select Pieces</h2>
          <div class="tryon-garments-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0; flex-shrink: 0;">
            <div id="garment-0" class="tryon-garment-box" style="width: ${sizes.garmentBoxSize}px; height: ${sizes.garmentBoxSize}px; box-sizing: border-box;">
              ${TRYON_SVG.garment0}
            </div>
            <div id="garment-1" class="tryon-garment-box" style="width: ${sizes.garmentBoxSize}px; height: ${sizes.garmentBoxSize}px; box-sizing: border-box;">
              ${TRYON_SVG.garment1}
            </div>
            <div id="garment-2" class="tryon-garment-box" style="width: ${sizes.garmentBoxSize}px; height: ${sizes.garmentBoxSize}px; box-sizing: border-box;">
              ${TRYON_SVG.garment2}
            </div>
          </div>
        </section>
      </div>

      <!-- Footer -->
      <div style="padding: 20px ${layoutConfig.horizontalPadding}px; flex-shrink: 0; border-top: 1px solid #f3f4f6; box-sizing: border-box; background: white;">
        <button id="submit-btn" class="tryon-submit-btn" style="width: 100%; height: 48px; display: flex; align-items: center; justify-content: center;" disabled>Try Look</button>
      </div>
    `;

    panel.appendChild(loadingOverlay);
    setupFileInputs();
  }

  function setupFileInputs() {
    const closeBtn = shadowQuerySelector('.close-panel-btn');
    if (closeBtn) {
      closeBtn.onclick = closePanel;
    }

    const userUpload = shadowQuerySelector('#user-upload');
    if (userUpload) {
      userUpload.onclick = (e) => {
        if (e.target.closest('#open-camera-btn')) return;
        selectFile('user');
      };
      addDragDrop(userUpload, 'user', 0);

      // Camera button
      const cameraBtnEl = shadowQuerySelector('#open-camera-btn');
      if (cameraBtnEl) {
        cameraBtnEl.onclick = (e) => { e.stopPropagation(); openCamera(); };
        cameraBtnEl.onmouseover = () => { cameraBtnEl.style.background = '#fff'; cameraBtnEl.style.borderColor = '#2F3C4F'; };
        cameraBtnEl.onmouseout = () => { cameraBtnEl.style.background = 'white'; cameraBtnEl.style.borderColor = '#cbd5e1'; };
      }
    }

    for (let i = 0; i < 3; i++) {
      const garmentBox = shadowQuerySelector('#garment-' + i);
      if (garmentBox) {
        garmentBox.onclick = () => selectFile('garment', i);
        addDragDrop(garmentBox, 'garment', i);
      }
    }

    const submitBtn = shadowQuerySelector('#submit-btn');
    if (submitBtn) {
      submitBtn.onclick = (e) => {
        if (!submitBtn.disabled) {
          generateTryOn();
        }
      };
      submitBtn.onmouseover = () => {
        if (!submitBtn.disabled) {
          submitBtn.style.transform = 'translateY(-2px)';
        }
      };
      submitBtn.onmouseout = () => {
        submitBtn.style.transform = 'translateY(0)';
      };
    }

    if (!overlay._dragListenerSetup) {
      overlay._dragListenerSetup = true;

      overlay.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); }, false);
      overlay.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }, false);
      overlay.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); }, false);
      overlay.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files.length > 0) {
          var file = e.dataTransfer.files[0];
          var targetIndex = state.garments.findIndex(g => g === null);
          if (targetIndex === -1) targetIndex = 0;
          handleFileFromDrop(file, 'garment', targetIndex);
        }
      }, false);
    }

    setupGlobalDragDrop();
  }

  function setupGlobalDragDrop() {
    if (container._tryonDragSetup) return;
    container._tryonDragSetup = true;

    // En Mac/Safari el shadow host tiene pointer-events:none y no recibe drag events.
    // Usamos el panel directamente (pointer-events:auto) para capturar drag dentro del widget.
    // Para archivos soltados FUERA del panel, usamos document con detección de posición.

    // Drag sobre el panel (funciona en Mac y Windows)
    panel.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }, false);

    panel.addEventListener('drop', function(e) {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault(); e.stopPropagation();
      var file = e.dataTransfer.files[0];
      var targetIndex = state.garments.findIndex(g => g === null);
      if (targetIndex === -1) targetIndex = 0;
      handleFileFromDrop(file, 'garment', targetIndex);
    }, false);

    // Fallback para document — solo cuando el panel está abierto y el drop cae cerca
    document.addEventListener('dragover', function(e) {
      if (!state.isOpen) return;
      var rect = panel.getBoundingClientRect();
      var inPanel = e.clientX >= rect.left && e.clientX <= rect.right &&
                    e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (inPanel) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
    }, false);

    document.addEventListener('drop', function(e) {
      if (!state.isOpen || !e.dataTransfer.files.length) return;
      var rect = panel.getBoundingClientRect();
      var inPanel = e.clientX >= rect.left && e.clientX <= rect.right &&
                    e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inPanel) return;
      e.preventDefault(); e.stopPropagation();
      var file = e.dataTransfer.files[0];
      var targetIndex = state.garments.findIndex(g => g === null);
      if (targetIndex === -1) targetIndex = 0;
      handleFileFromDrop(file, 'garment', targetIndex);
    }, false);
  }

  function openCamera() {
    // Put modal in document.body so events work reliably outside shadow DOM
    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:2147483648;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
    document.body.appendChild(modal);

    // Video element
    var videoWrap = document.createElement('div');
    videoWrap.style.cssText = 'position:relative;border-radius:16px;overflow:hidden;background:#000;max-width:340px;width:90%;';

    var video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.cssText = 'width:100%;display:block;border-radius:16px;';
    videoWrap.appendChild(video);

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.6);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:20px;line-height:1;z-index:10;';
    videoWrap.appendChild(closeBtn);
    modal.appendChild(videoWrap);

    // Countdown + capture button
    var bottomWrap = document.createElement('div');
    bottomWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;';

    var countEl = document.createElement('div');
    countEl.style.cssText = 'display:none;color:white;font-size:56px;font-weight:700;line-height:1;text-shadow:0 2px 12px rgba(0,0,0,0.6);min-height:64px;';
    bottomWrap.appendChild(countEl);

    var captureBtn = document.createElement('button');
    captureBtn.style.cssText = 'background:white;border:none;border-radius:50%;width:68px;height:68px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.4);transition:transform 0.15s,opacity 0.2s;padding:0;';
    var inner = document.createElement('div');
    inner.style.cssText = 'width:52px;height:52px;border-radius:50%;background:#2F3C4F;border:2px solid #cbd5e1;';
    captureBtn.appendChild(inner);
    bottomWrap.appendChild(captureBtn);

    var hint = document.createElement('div');
    hint.textContent = 'Tap to take photo';
    hint.style.cssText = 'color:rgba(255,255,255,0.6);font-size:12px;';
    bottomWrap.appendChild(hint);
    modal.appendChild(bottomWrap);

    // Canvas (hidden)
    var canvas = document.createElement('canvas');
    canvas.style.display = 'none';
    modal.appendChild(canvas);

    var stream = null;

    function closeModal() {
      if (stream) stream.getTracks().forEach(function(t) { t.stop(); });
      if (document.body.contains(modal)) document.body.removeChild(modal);
    }

    function capture() {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d').drawImage(video, 0, 0);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      closeModal();
      state.userImage = dataUrl;
      state.userImageFile = null;
      updateUserUploadBox(true, dataUrl);
      updateSubmitButton();
    }

    // Start camera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(function(s) {
        stream = s;
        video.srcObject = stream;
      })
      .catch(function(err) {
        videoWrap.innerHTML = '<div style="color:white;text-align:center;padding:32px;font-size:13px;">📷<br><br>Camera not available<br><span style="color:#aaa;font-size:11px;">' + err.message + '</span></div>';
        setTimeout(closeModal, 3000);
      });

    // Events
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });

    captureBtn.addEventListener('click', function() {
      captureBtn.disabled = true;
      captureBtn.style.opacity = '0.5';
      hint.style.display = 'none';
      var count = 3;
      countEl.textContent = count;
      countEl.style.display = 'block';
      var interval = setInterval(function() {
        count--;
        if (count > 0) {
          countEl.textContent = count;
        } else {
          clearInterval(interval);
          countEl.style.display = 'none';
          capture();
        }
      }, 1000);
    });

    captureBtn.addEventListener('mouseover', function() { if (!captureBtn.disabled) captureBtn.style.transform = 'scale(1.08)'; });
    captureBtn.addEventListener('mouseout', function() { captureBtn.style.transform = 'scale(1)'; });
  }

  function selectFile(type, index = 0) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => handleFileSelect(e, type, index);
    input.click();
  }

  function handleFileSelect(event, type, index) {
    const file = event.target.files[0];
    if (!file) return;
    processFile(file, type, index);
  }

  function handleFileFromDrop(file, type, index) {
    if (!file || !file.type.startsWith('image/')) return;
    processFile(file, type, index);
  }

  function processFile(file, type, index) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64 = e.target.result;

      function applyImage(finalBase64) {
        if (type === 'user') {
          state.userImage = finalBase64;
          state.userImageFile = file;
          updateUserUploadBox(true, finalBase64);
        } else {
          state.garments[index] = finalBase64;
          state.garmentFiles[index] = file;
          updateGarmentBox(index, true, finalBase64);
        }
        preUploadImage(finalBase64, finalBase64.substring(0, 100));
        updateSubmitButton();
      }

      if (type === 'user') {
        // Persona: comprimir a 1024px para no exceder limites de payload (~1MB max)
        compressImage(base64, 1024, 0.90).then(applyImage).catch(function() { applyImage(base64); });
      } else {
        // Garment: comprimir a 1024px con alta calidad para buen detalle sin exceder payload
        compressImage(base64, 1024, 0.95).then(applyImage).catch(function() { applyImage(base64); });
      }
    };
    reader.readAsDataURL(file);
  }

  function addDragDrop(element, type, index) {
    element.addEventListener('dragenter', function(e) {
        e.preventDefault(); e.stopPropagation();
        element.style.borderColor = '#2F3C4F';
        element.style.background = '#F8F9FA';
        element.style.transform = 'translateY(-1px)';
      }, false);

    element.addEventListener('dragover', function(e) {
        e.preventDefault(); e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        element.style.borderColor = '#2F3C4F';
        element.style.background = '#F8F9FA';
        element.style.transform = 'translateY(-1px)';
      }, false);

    element.addEventListener('dragleave', function(e) {
      e.preventDefault(); e.stopPropagation();
      element.style.borderColor = element.classList.contains('has-image') ? '#10b981' : '#E5E7EB';
      element.style.background = element.classList.contains('has-image') ? '#f0fdf4' : '#F8F9FA';
      element.style.transform = 'translateY(0)';
    }, false);

    element.addEventListener('drop', function(e) {
      e.preventDefault(); e.stopPropagation();
      element.style.borderColor = element.classList.contains('has-image') ? '#10b981' : '#E5E7EB';
      element.style.background = element.classList.contains('has-image') ? '#f0fdf4' : '#F8F9FA';
      element.style.transform = 'translateY(0)';
      var file = e.dataTransfer.files[0];
      if (file) { handleFileFromDrop(file, type, index); }
    }, false);
  }

  function updateUserUploadBox(hasImage, imageSrc = null) {
    const box = shadowQuerySelector('#user-upload');
    const sizes = calculateBoxSizes();

    if (hasImage && imageSrc) {
      box.classList.add('has-image');
      box.style.padding = '0';
      box.style.overflow = 'hidden';
      box.style.width = sizes.userBoxWidth + 'px';
      box.style.height = sizes.userBoxHeight + 'px';
      box.innerHTML = `
        <div style="width:100%;height:100%;position:relative;border-radius:12px;overflow:hidden;">
          <img src="${imageSrc}" alt="User photo" style="width:100%;height:100%;object-fit:cover;" />
          <button class="remove-user-btn" style="position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 50%; background: white; border: none; color: black; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" title="Remove photo">×</button>
        </div>
      `;
      const removeBtn = box.querySelector('.remove-user-btn');
      if (removeBtn) {
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          state.userImage = null;
          state.userImageFile = null;
          updateUserUploadBox(false);
          updateSubmitButton();
        };
      }
    } else {
      box.classList.remove('has-image');
      box.style.padding = '16px';
      box.style.overflow = '';
      box.style.width = sizes.userBoxWidth + 'px';
      box.style.height = sizes.userBoxHeight + 'px';
      box.innerHTML = `
        <div style="margin-bottom: 16px; color: #94a3b8;">${TRYON_SVG.uploadCam}</div>
        <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #2F3C4F; letter-spacing: 0.02em;">Upload a portrait</p>
        <p style="margin: 0 0 20px 0; font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.15em;">Drag &amp; Drop or Browse</p>
        <button id="open-camera-btn" class="tryon-capture-btn" style="background: white; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px 22px; font-size: 10px; font-weight: 700; color: #2F3C4F; text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
          ${TRYON_SVG.capture}
          Capture Live
        </button>
      `;
      const cameraBtnEl = box.querySelector('#open-camera-btn');
      if (cameraBtnEl) {
        cameraBtnEl.onclick = (e) => { e.stopPropagation(); openCamera(); };
        cameraBtnEl.onmouseover = () => { cameraBtnEl.style.background = '#fff'; cameraBtnEl.style.borderColor = '#2F3C4F'; };
        cameraBtnEl.onmouseout = () => { cameraBtnEl.style.background = 'white'; cameraBtnEl.style.borderColor = '#cbd5e1'; };
      }
    }
  }

  function updateGarmentBox(index, hasImage, imageSrc = null) {
    const box = shadowQuerySelector('#garment-' + index);
    const sizes = calculateBoxSizes();

    if (hasImage && imageSrc) {
      box.classList.add('has-image');
      box.style.width = sizes.garmentBoxSize + 'px';
      box.style.height = sizes.garmentBoxSize + 'px';
      box.innerHTML = `
        <div style="width: 100%; height: 100%; border-radius: 10px; overflow: hidden; position: relative;">
          <img src="${imageSrc}" alt="Garment" style="width: 100%; height: 100%; object-fit: cover;" />
          <button class="remove-garment-btn" style="position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; background: white; border: none; color: black; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; line-height: 1; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" title="Remove garment">×</button>
        </div>
      `;
      const removeBtn = box.querySelector('.remove-garment-btn');
      if (removeBtn) {
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          state.garments[index] = null;
          state.garmentFiles[index] = null;
          updateGarmentBox(index, false);
          updateSubmitButton();
        };
      }
    } else {
      const garmentSvgs = [TRYON_SVG.garment0, TRYON_SVG.garment1, TRYON_SVG.garment2];
      box.classList.remove('has-image');
      box.style.width = sizes.garmentBoxSize + 'px';
      box.style.height = sizes.garmentBoxSize + 'px';
      box.innerHTML = garmentSvgs[index];
    }
  }

  function updateSubmitButton() {
    const submitBtn = shadowQuerySelector('#submit-btn');
    if (!submitBtn) return;

    const hasUserImage = !!state.userImage;
    const hasGarments = state.garments.some(g => g !== null);

    submitBtn.disabled = !hasUserImage || !hasGarments;
    if (submitBtn.disabled) {
      submitBtn.style.opacity = '0.5';
      submitBtn.style.cursor = 'not-allowed';
      submitBtn.style.transform = 'none';
    } else {
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
  }

  async function generateTryOn() {
    if (state.isGenerating) return;

    state.isGenerating = true;
    const submitBtn = shadowQuerySelector('#submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating...';

    showLoading();

    // Enviar imagenes comprimidas en base64 directamente
    // El backend se encarga de subirlas a FAL storage antes de llamar al modelo
    const userImagePayload = state.userImage;
    const garmentsPayload = state.garments.filter(g => g !== null);
    console.log('[TryOn] Generate - enviando imagenes al backend para procesar');

    fetch(BACKEND_URL + '/api/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: API_KEY,
        userImage: userImagePayload,
        garments: garmentsPayload
      })
    })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        state.resultUrl = result.data.resultUrl;
        state.loadingProgress = 100;
        updateProgressBar();
        setTimeout(() => {
          hideLoading();
          showResult();
        }, 500);
      } else {
        hideLoading();
        showError(result.error);
      }
    })
    .catch(error => {
      hideLoading();
      showError('Network error - please try again');
    })
    .finally(() => {
      state.isGenerating = false;
      updateSubmitButton();
    });
  }

  function showLoading() {
    loadingOverlay.style.display = 'flex';
    state.currentLoadingPhase = 0;
    state.loadingProgress = 0;
    startLoadingAnimation();
  }

  function hideLoading() {
    loadingOverlay.style.display = 'none';
    stopLoadingAnimation();
  }

  function startLoadingAnimation() {
    const TOTAL_MS = 28000; // +3s para que 0→90% tarde 18s (antes 15s)
    const INTERVAL_MS = 300;
    const totalTicks = TOTAL_MS / INTERVAL_MS;
    const fastTicks = Math.round(18000 / INTERVAL_MS); // 18 segundos → 0 to 90
    const slowTicks = totalTicks - fastTicks;       // 40% of time → 90 to 99
    let tick = 0;

    const progressInterval = setInterval(() => {
      tick++;
      if (tick <= fastTicks) {
        // Linear 0→90 in first 60% of time
        state.loadingProgress = Math.min(90, (tick / fastTicks) * 90);
      } else {
        // Linear 90→99 in last 40% of time — never reaches 100
        const slowTick = tick - fastTicks;
        state.loadingProgress = Math.min(99, 90 + (slowTick / slowTicks) * 9);
      }
      updateProgressBar();
    }, INTERVAL_MS);

    let phaseTimeout;
    function nextPhase() {
      if (state.currentLoadingPhase < loadingPhases.length - 1) {
        state.currentLoadingPhase++;
        updateLoadingText();
        const duration = loadingPhases[state.currentLoadingPhase].duration;
        if (duration !== Infinity) {
          phaseTimeout = setTimeout(nextPhase, duration);
        }
      }
    }

    updateLoadingText();
    phaseTimeout = setTimeout(nextPhase, loadingPhases[0].duration);

    loadingOverlay._progressInterval = progressInterval;
    loadingOverlay._phaseTimeout = phaseTimeout;
  }

  function stopLoadingAnimation() {
    if (loadingOverlay._progressInterval) {
      clearInterval(loadingOverlay._progressInterval);
    }
    if (loadingOverlay._phaseTimeout) {
      clearTimeout(loadingOverlay._phaseTimeout);
    }
  }

  function updateLoadingText() {
    const phase = loadingPhases[state.currentLoadingPhase];
    const description = phase.description || '';
    const phaseIndex = state.currentLoadingPhase;
    const dots = Array.from({length: 4}, (_, i) =>
      `<div style="width:8px;height:8px;border-radius:50%;background:${i === phaseIndex ? 'linear-gradient(135deg,#2F3C4F,#6D5ED2)' : '#e5e7eb'};transition:background 0.4s;"></div>`
    ).join('');
    loadingOverlay.innerHTML = `
      <div class="tryon-loading-content" style="gap:0;">
        <div class="tryon-loading-text" style="margin-bottom:6px;">${phase.text}</div>
        <div class="tryon-loading-desc" style="margin-bottom:24px;">${description}</div>
        <div style="display:flex;gap:8px;margin-bottom:28px;">${dots}</div>
      </div>
      <div class="tryon-progress-container">
        <div class="tryon-progress-header">
          <span class="tryon-progress-label">AI WORKING</span>
          <span class="tryon-progress-percent">${Math.round(state.loadingProgress)}%</span>
        </div>
        <div class="tryon-progress-bar">
          <div class="tryon-progress-fill" style="width: ${state.loadingProgress}%"></div>
        </div>
      </div>
    `;
  }

  function updateProgressBar() {
    const percentElement = loadingOverlay.querySelector('.tryon-progress-percent');
    const fillElement = loadingOverlay.querySelector('.tryon-progress-fill');
    if (percentElement) {
      percentElement.textContent = Math.round(state.loadingProgress) + '%';
    }
    if (fillElement) {
      fillElement.style.width = state.loadingProgress + '%';
    }
  }

  function showResult() {
    panel.style.height = 'calc(100vh - 100px)';
    panel.style.display = 'block';

    const userThumbnail = state.userImage
      ? `<div class="tryon-thumbnail"><img src="${state.userImage}" alt="Your photo" /></div>`
      : '';
    const garmentThumbnails = state.garments
      .map((garment, index) => garment
        ? `<div class="tryon-thumbnail"><img src="${garment}" alt="Garment ${index + 1}" /></div>`
        : '')
      .filter(Boolean)
      .join('');

    const usedGarments = state.garments.filter(g => g !== null).length;
    const addMoreButton = usedGarments < 3
      ? '<div class="tryon-thumbnail tryon-add-more add-more-btn"><span>+</span></div>'
      : '';

    const proxiedResultUrl = BACKEND_URL + '/api/proxy?url=' + encodeURIComponent(state.resultUrl);

    panel.innerHTML = `
      <button class="tryon-close-btn close-result-btn">×</button>
      <div style="height: 100%; display: flex; flex-direction: column;">
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 8px 12px 0 12px; overflow: hidden;">
          <div class="tryon-result-image-container">
            <img src="${proxiedResultUrl}" alt="Try-on result" class="tryon-result-image" crossorigin="anonymous" />
          </div>
        </div>

        <div class="tryon-images-used">
          <div class="tryon-images-used-label">IMAGES USED</div>
          <div class="tryon-thumbnails">
            ${userThumbnail}
            ${garmentThumbnails}
            ${addMoreButton}
          </div>
        </div>

        <div style="padding: 8px 16px 12px 16px;">
          <button class="tryon-try-again-btn reset-btn">Try another look</button>
        </div>
      </div>
    `;

    const closeBtn = shadowQuerySelector('.close-result-btn');
    if (closeBtn) { closeBtn.onclick = closePanel; }

    const addMoreBtn = shadowQuerySelector('.add-more-btn');
    if (addMoreBtn) {
      addMoreBtn.onclick = () => {
        panel.style.height = layoutConfig.panelTotalHeight + 'px';
        panel.style.display = 'flex';
        renderPanel();
      };
    }

    const resetBtn = shadowQuerySelector('.reset-btn');
    if (resetBtn) {
      resetBtn.onclick = () => {
        // Keep userImage so the model photo stays selected
        state.garments = [null, null, null];
        state.garmentFiles = [null, null, null];
        state.resultUrl = null;
        panel.style.height = layoutConfig.panelTotalHeight + 'px';
        panel.style.display = 'flex';
        renderPanel();
        // Restore user image in the box after render
        if (state.userImage) {
          setTimeout(() => updateUserUploadBox(true, state.userImage), 0);
        }
      };
    }

    const resultImage = shadowQuerySelector('.tryon-result-image');
    const imageContainer = shadowQuerySelector('.tryon-result-image-container');

    if (resultImage && imageContainer) {
      let isZoomed = false;

      resultImage.addEventListener('click', function(e) {
        isZoomed = !isZoomed;
        if (isZoomed) {
          resultImage.classList.add('zoomed');
          updateZoomPosition(e);
        } else {
          resultImage.classList.remove('zoomed');
          resultImage.style.transformOrigin = 'center center';
        }
      });

      resultImage.addEventListener('mousemove', function(e) {
        if (isZoomed) { updateZoomPosition(e); }
      });

      resultImage.addEventListener('mouseleave', function() {
        if (isZoomed) {
          isZoomed = false;
          resultImage.classList.remove('zoomed');
          resultImage.style.transformOrigin = 'center center';
        }
      });

      function updateZoomPosition(e) {
        const rect = resultImage.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const constrainedX = Math.max(25, Math.min(75, x));
        const constrainedY = Math.max(25, Math.min(75, y));
        resultImage.style.transformOrigin = `${constrainedX}% ${constrainedY}%`;
      }
    }
  }

  function showError(message) {
    panel.innerHTML = `
      <div style="padding: 24px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-family: Inter, sans-serif;">
        <h3 style="font-family: 'Playfair Display', Georgia, serif; font-size: 20px; font-weight: 600; color: #2F3C4F; margin-bottom: 8px;">Something went wrong</h3>
        <p style="color: #94a3b8; margin-bottom: 24px; font-size: 14px;">${message}</p>
        <button class="error-reset-btn tryon-submit-btn" style="width: auto; min-width: 200px; padding: 14px 28px;">Try Again</button>
      </div>
    `;

    const resetBtn = shadowQuerySelector('.error-reset-btn');
    if (resetBtn) {
      resetBtn.onclick = () => {
        panel.style.height = layoutConfig.panelTotalHeight + 'px';
        panel.style.display = 'flex';
        renderPanel();
      };
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window[WIDGET_ID] = { state, close: closePanel };
})();