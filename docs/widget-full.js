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
    resultUrl: null,
    error: null,
    currentLoadingPhase: 0,
    loadingProgress: 0
  };

  // DOM elements
  let container, fab, panel, overlay, loadingOverlay;

  // Layout configuration
  const layoutConfig = {
    panelWidth: 320,
    panelTotalHeight: 540,
    headerHeight: 55,
    footerHeight: 70,
    horizontalPadding: 20,
    verticalGap: 12,
    userBoxHeight: 180,  // Fixed height for user image
    garmentBoxSize: 85  // Fixed size for garments (3 boxes = 85*3 + 12*2 gaps = 279px fits in 280px)
  };

  // Helper function to query shadow DOM
  function shadowQuerySelector(selector) {
    return container._shadowRoot.querySelector(selector);
  }

  // Return fixed box sizes
  function calculateBoxSizes() {
    // Calculate userBoxWidth to fit panel width minus padding
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
    { text: 'Analyzing',  duration: 3000 },
    { text: 'Adjusting',  duration: 3000 },
    { text: 'Applying', duration: 4000 },
    { text: 'Finalizing', duration: Infinity }
  ];

  // Image compression functionssd
  function compressImage(base64, maxHeight, quality) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var ratio = maxHeight / img.height;
        if (img.height <= maxHeight) { ratio = 1; }
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = base64;
    });
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
    // Create container
    container = document.createElement('div');
    container.id = WIDGET_ID;
    container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 2147483647; pointer-events: none;';
    document.body.appendChild(container);

    // Create Shadow DOM
    var shadow = container.attachShadow({ mode: 'open' });

    // Create wrapper inside shadow root
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
    shadow.appendChild(wrapper);

    // Floating Action Button
    fab = document.createElement('button');
    fab.innerHTML = '✨ Try Look';
    fab.style.cssText = 'position: fixed; bottom: 24px; right: 24px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 28px; padding: 16px 24px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s; pointer-events: auto;';
    fab.onmouseover = () => fab.style.transform = 'translateY(-2px)';
    fab.onmouseout = () => fab.style.transform = 'translateY(0)';
    wrapper.appendChild(fab);

    // Overlay (invisible but for event interception)
    overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: transparent; display: none; pointer-events: none;';
    wrapper.appendChild(overlay);

    // Main panel
    panel = document.createElement('div');
    panel.style.cssText = 'position: fixed; bottom: 82px; right: 24px; width: ' + layoutConfig.panelWidth + 'px; height: ' + layoutConfig.panelTotalHeight + 'px; background: white; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); display: none; overflow: hidden; flex-direction: column; transition: height 0.4s ease; pointer-events: auto;';
    wrapper.appendChild(panel);

    // Loading overlay
    loadingOverlay = document.createElement('div');
    loadingOverlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.98); z-index: 10; display: none; flex-direction: column; justify-content: center; align-items: center; pointer-events: auto;';
    panel.appendChild(loadingOverlay);

    // Store shadow root for later use
    container._shadowRoot = shadow;
    container._wrapper = wrapper;

    renderPanel();
  }

  function attachStyles() {
    const style = document.createElement('style');
    style.textContent = `
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
        border: 2px dashed #e0e7ff;
        border-radius: 12px;
        padding: 12px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
        background: #f8fafc;
        position: relative;
      }

      .tryon-upload-box:hover {
        border-color: #667eea;
        background: #f0f4ff;
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
        font-size: 13px;
        font-weight: 600;
        color: #374151;
        margin-bottom: 2px;
      }

      .tryon-upload-hint {
        font-size: 11px;
        color: #6b7280;
      }

      .tryon-section-title {
        font-size: 13px;
        font-weight: 600;
        color: #374151;
        margin-bottom: 6px;
      }

      .tryon-garments-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-bottom: 12px;
      }

      .tryon-garment-box {
        aspect-ratio: 1;
        border: 2px dashed #e0e7ff;
        border-radius: 10px;
        background: #f8fafc;
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
        border-color: #667eea;
        background: #f0f4ff;
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
        height: 44px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        border: none;
        border-radius: 12px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: transform 0.2s;
        margin-top: 0;
        flex-shrink: 0;
      }

      .tryon-submit-btn:hover:not(:disabled) {
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
        background: radial-gradient(circle, #ddd6fe 0%, #e0e7ff 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 24px;
        animation: pulse 2s infinite;
        box-shadow: 0 8px 24px rgba(102,126,234,0.15);
      }

      .tryon-loading-text {
        font-size: 24px;
        font-weight: 700;
        color: #1e293b;
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
        background: linear-gradient(90deg, #667eea, #764ba2);
        border-radius: 999px;
        transition: width 0.5s ease;
      }

      .tryon-result-image-container {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .tryon-result-image {
        width: 100%;
        max-height: calc(100vh - 300px);
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
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
      }

      .tryon-images-used-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #94a3b8;
        margin-bottom: 12px;
        text-align: center;
      }

      .tryon-thumbnails {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-bottom: 16px;
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
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(251,191,36,0.2);
      }

      .tryon-try-again-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(251,191,36,0.3);
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
        border-color: #667eea !important;
        color: #667eea;
      }
    `;
    container._shadowRoot.appendChild(style);
  }

  function attachEvents() {
    fab.onclick = openPanel;
  }

  function openPanel() {
    state.isOpen = true;
    overlay.style.display = 'block';
    panel.style.display = 'flex';
    panel.style.animation = 'slideIn 0.3s ease';
  }

  function closePanel() {
    state.isOpen = false;
    overlay.style.display = 'none';
    panel.style.display = 'none';
    // Reset panel height
    panel.style.height = layoutConfig.panelTotalHeight + 'px';
  }

  function renderPanel() {
    // Calculate dynamic sizes
    const sizes = calculateBoxSizes();

    panel.innerHTML = `
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px ${layoutConfig.horizontalPadding}px; flex-shrink: 0; border-bottom: 1px solid #e5e7eb; box-sizing: border-box;">
        <span style="font-size: 13px; color: #6b7280; font-weight: 500; display: flex; align-items: center; gap: 4px;">
          ✨ TryOn
        </span>
        <button class="close-panel-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #6b7280; padding: 0; line-height: 1; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;" title="Close panel">×</button>
      </div>

      <!-- Content -->
      <div style="flex: 1; display: flex; flex-direction: column; padding: ${layoutConfig.verticalGap}px ${layoutConfig.horizontalPadding}px; gap: ${layoutConfig.verticalGap}px; overflow: hidden; box-sizing: border-box;">
        <div style="font-size: 12px; font-weight: 600; color: #374151; margin: 0; flex-shrink: 0;">Upload your photo</div>
        <div id="user-upload" class="tryon-upload-box" style="width: ${sizes.userBoxWidth}px; height: ${sizes.userBoxHeight}px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;">
          <div style="font-size: 40px; margin-bottom: 8px; opacity: 0.6;">📷</div>
          <div style="font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 2px;">Upload your photo</div>
          <div style="font-size: 11px; color: #6b7280;">Click or drag to upload</div>
        </div>

        <div style="font-size: 12px; font-weight: 600; color: #374151; margin: 0; flex-shrink: 0;">Add garments (up to 3)</div>
        <div class="tryon-garments-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: ${layoutConfig.verticalGap}px; margin: 0; flex-shrink: 0;">
          <div id="garment-0" class="tryon-garment-box" style="width: ${sizes.garmentBoxSize}px; height: ${sizes.garmentBoxSize}px; border: 2px dashed #e0e7ff; border-radius: 10px; background: #f8fafc; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; box-sizing: border-box;">
            <div style="font-size: 28px;">👕</div>
          </div>
          <div id="garment-1" class="tryon-garment-box" style="width: ${sizes.garmentBoxSize}px; height: ${sizes.garmentBoxSize}px; border: 2px dashed #e0e7ff; border-radius: 10px; background: #f8fafc; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; box-sizing: border-box;">
            <div style="font-size: 28px;">👔</div>
          </div>
          <div id="garment-2" class="tryon-garment-box" style="width: ${sizes.garmentBoxSize}px; height: ${sizes.garmentBoxSize}px; border: 2px dashed #e0e7ff; border-radius: 10px; background: #f8fafc; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; box-sizing: border-box;">
            <div style="font-size: 28px;">👗</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding: 12px ${layoutConfig.horizontalPadding}px; flex-shrink: 0; border-top: 1px solid #e5e7eb; box-sizing: border-box;">
        <button id="submit-btn" style="width: 100%; height: 44px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 10px; font-weight: 600; font-size: 15px; cursor: pointer; transition: transform 0.2s, opacity 0.2s; display: flex; align-items: center; justify-content: center;" disabled>Try Look</button>
      </div>
    `;

    // Re-add loading overlay
    panel.appendChild(loadingOverlay);

    // Attach file input events
    setupFileInputs();
  }

  function setupFileInputs() {
    // Close button
    const closeBtn = shadowQuerySelector('.close-panel-btn');
    if (closeBtn) {
      closeBtn.onclick = closePanel;
    }

    // User image
    const userUpload = shadowQuerySelector('#user-upload');
    userUpload.onclick = () => selectFile('user');
    addDragDrop(userUpload, 'user', 0);

    // Garments
    for (let i = 0; i < 3; i++) {
      const garmentBox = shadowQuerySelector('#garment-' + i);
      garmentBox.onclick = () => selectFile('garment', i);
      addDragDrop(garmentBox, 'garment', i);
    }

    // Submit button
    const submitBtn = shadowQuerySelector('#submit-btn');
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

    // Add global drag & drop interception for external drag sources
    setupGlobalDragDrop();
  }

  function setupGlobalDragDrop() {
    // Prevent drag default behavior globally
    document.addEventListener('dragover', function(e) {
      if (state.isOpen && container._dragTargets) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    document.addEventListener('drop', function(e) {
      if (state.isOpen && container._dragTargets && e.dataTransfer.files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        
        // Try to find the closest target element in panel
        var file = e.dataTransfer.files[0];
        
        // Default to first empty garment slot
        var targetIndex = state.garments.findIndex(g => g === null);
        if (targetIndex === -1) targetIndex = 0;
        
        handleFileFromDrop(file, 'garment', targetIndex);
      }
    }, true);
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

      // Compress image (maxHeight: 768px, quality: 0.75)
      compressImage(base64, 768, 0.75).then(function(compressedBase64) {
        if (type === 'user') {
          state.userImage = compressedBase64;
          state.userImageFile = file;
          updateUserUploadBox(true, compressedBase64);
        } else {
          state.garments[index] = compressedBase64;
          state.garmentFiles[index] = file;
          updateGarmentBox(index, true, compressedBase64);
        }
        updateSubmitButton();
      }).catch(function(error) {
        console.error('Error compressing image:', error);
        // Fallback to original base64
        if (type === 'user') {
          state.userImage = base64;
          state.userImageFile = file;
          updateUserUploadBox(true, base64);
        } else {
          state.garments[index] = base64;
          state.garmentFiles[index] = file;
          updateGarmentBox(index, true, base64);
        }
        updateSubmitButton();
      });
    };
    reader.readAsDataURL(file);
  }

  function addDragDrop(element, type, index) {
    // Store reference for external drag handling
    if (!container._dragTargets) {
      container._dragTargets = [];
    }
    container._dragTargets.push({ element, type, index });

    element.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
      element.style.borderColor = '#667eea';
      element.style.background = '#f0f4ff';
      element.style.transform = 'translateY(-1px)';
    }, true);

    element.addEventListener('dragleave', function(e) {
      e.preventDefault();
      e.stopPropagation();
      element.style.borderColor = element.classList.contains('has-image') ? '#10b981' : '#e0e7ff';
      element.style.background = element.classList.contains('has-image') ? '#f0fdf4' : '#f8fafc';
      element.style.transform = 'translateY(0)';
    }, true);

    element.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      element.style.borderColor = element.classList.contains('has-image') ? '#10b981' : '#e0e7ff';
      element.style.background = element.classList.contains('has-image') ? '#f0fdf4' : '#f8fafc';
      element.style.transform = 'translateY(0)';

      var file = e.dataTransfer.files[0];
      handleFileFromDrop(file, type, index);
    }, true);
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
      
      // Attach event listener to remove button
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
        <div style="font-size: 40px; margin-bottom: 8px; opacity: 0.6;">📷</div>
        <div style="font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 2px;">Upload your photo</div>
        <div style="font-size: 11px; color: #6b7280;">Click or drag to upload</div>
      `;
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
      
      // Attach event listener to remove button
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
      const emojis = ['👕', '👔', '👗'];
      box.classList.remove('has-image');
      box.style.width = sizes.garmentBoxSize + 'px';
      box.style.height = sizes.garmentBoxSize + 'px';
      box.innerHTML = `<div style="font-size: 28px;">${emojis[index]}</div>`;
    }
  }

  function updateSubmitButton() {
    const submitBtn = shadowQuerySelector('#submit-btn');
    if (!submitBtn) return; // Button might not exist if panel is showing results
    
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

  function generateTryOn() {
    if (state.isGenerating) return;

    state.isGenerating = true;
    const submitBtn = shadowQuerySelector('#submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating...';

    // Show loading overlay
    showLoading();

    fetch(BACKEND_URL + '/api/images/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: API_KEY,
        userImage: state.userImage,
        garments: state.garments.filter(g => g !== null)
      })
    })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        state.resultUrl = result.data.resultUrl;
        // Complete progress bar and show result
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
    // Start progress bar animation
    const progressInterval = setInterval(() => {
      if (state.loadingProgress < 90) {
        const increment = Math.max(0.5, (90 - state.loadingProgress) / 15);
        state.loadingProgress = Math.min(90, state.loadingProgress + increment);
        updateProgressBar();
      }
    }, 300);

    // Start phase changes
    let phaseTimeout;
    function nextPhase() {
      if (state.currentLoadingPhase < loadingPhases.length - 1) {
        state.currentLoadingPhase++;
        updateLoadingText();
        phaseTimeout = setTimeout(nextPhase, loadingPhases[state.currentLoadingPhase].duration);
      }
    }

    // Initial text update
    updateLoadingText();
    phaseTimeout = setTimeout(nextPhase, loadingPhases[0].duration);

    // Store intervals for cleanup
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
    loadingOverlay.innerHTML = `
      <div class="tryon-loading-content">
        <div class="tryon-loading-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: #667eea;">
            <path d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.012ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 0 1-.75 0 .375.375 0 0 1 .75 0Z"/>
          </svg>
        </div>
        <div class="tryon-loading-text">${phase.text}</div>
        <div class="tryon-loading-desc">${phase.description}</div>
      </div>
      <div class="tryon-progress-container">
        <div class="tryon-progress-header">
          <span class="tryon-progress-label">PROCESSING</span>
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
    // Expand panel height
    panel.style.height = 'calc(100vh - 100px)';
    panel.style.display = 'block';

    // Create thumbnails for images used
    const userThumbnail = state.userImage ? `<div class="tryon-thumbnail"><img src="${state.userImage}" alt="Your photo" /></div>` : '';
    const garmentThumbnails = state.garments
      .map((garment, index) => garment ? `<div class="tryon-thumbnail"><img src="${garment}" alt="Garment ${index + 1}" /></div>` : '')
      .filter(Boolean)
      .join('');

    // Add "+" button if there are available slots
    const usedGarments = state.garments.filter(g => g !== null).length;
    const addMoreButton = usedGarments < 3 ? '<div class="tryon-thumbnail tryon-add-more add-more-btn"><span>+</span></div>' : '';

    // Use proxy to avoid CORS/CSP issues with FAL images
    const proxiedResultUrl = BACKEND_URL + '/api/proxy?url=' + encodeURIComponent(state.resultUrl);

    panel.innerHTML = `
      <button class="tryon-close-btn close-result-btn">×</button>
      <div style="height: 100%; display: flex; flex-direction: column;">
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px 24px 0 24px; overflow: hidden;">
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

        <div style="padding: 12px 24px;">
          <button class="tryon-try-again-btn reset-btn">Try another look</button>
        </div>
      </div>
    `;

    // Attach event listeners
    const closeBtn = shadowQuerySelector('.close-result-btn');
    if (closeBtn) {
      closeBtn.onclick = closePanel;
    }

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
        state.userImage = null;
        state.userImageFile = null;
        state.garments = [null, null, null];
        state.garmentFiles = [null, null, null];
        state.resultUrl = null;
        panel.style.height = layoutConfig.panelTotalHeight + 'px';
        panel.style.display = 'flex';
        renderPanel();
      };
    }

    // Add zoom functionality to result image
    const resultImage = shadowQuerySelector('.tryon-result-image');
    const imageContainer = shadowQuerySelector('.tryon-result-image-container');
    
    if (resultImage && imageContainer) {
      let isZoomed = false;

      resultImage.addEventListener('click', function(e) {
        isZoomed = !isZoomed;
        
        if (isZoomed) {
          resultImage.classList.add('zoomed');
          // Calculate initial zoom position based on click
          updateZoomPosition(e);
        } else {
          resultImage.classList.remove('zoomed');
          resultImage.style.transformOrigin = 'center center';
        }
      });

      resultImage.addEventListener('mousemove', function(e) {
        if (isZoomed) {
          updateZoomPosition(e);
        }
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
        
        // Constrain the zoom to keep it within visible bounds
        const constrainedX = Math.max(25, Math.min(75, x));
        const constrainedY = Math.max(25, Math.min(75, y));
        
        resultImage.style.transformOrigin = `${constrainedX}% ${constrainedY}%`;
      }
    }
  }

  function showError(message) {
    panel.innerHTML = `
      <div style="padding: 24px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
        <h3 style="font-size: 20px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">Something went wrong</h3>
        <p style="color: #64748b; margin-bottom: 24px;">${message}</p>
        <button class="error-reset-btn" style="padding: 12px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">Try Again</button>
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

  // Expose for debugging
  window[WIDGET_ID] = { state, close: closePanel };
})();