const state = {
  files: [],
  results: []
};

const elements = {
  fileInput: document.getElementById("fileInput"),
  selectButton: document.getElementById("selectButton"),
  processButton: document.getElementById("processButton"),
  downloadAllButton: document.getElementById("downloadAllButton"),
  resultsGrid: document.getElementById("resultsGrid"),
  statusText: document.getElementById("statusText"),
  dropZone: document.getElementById("dropZone"),
  colorPicker: document.getElementById("colorPicker"),
  hexInput: document.getElementById("hexInput"),
  toleranceInput: document.getElementById("toleranceInput"),
  toleranceValue: document.getElementById("toleranceValue"),
  featherInput: document.getElementById("featherInput"),
  featherValue: document.getElementById("featherValue"),
  erosionInput: document.getElementById("erosionInput"),
  erosionValue: document.getElementById("erosionValue"),
  decontaminateInput: document.getElementById("decontaminateInput"),
  template: document.getElementById("resultCardTemplate")
};

function syncSliderLabels() {
  elements.toleranceValue.textContent = elements.toleranceInput.value;
  elements.featherValue.textContent = elements.featherInput.value;
  elements.erosionValue.textContent = elements.erosionInput.value;
}

function syncColorFromPicker() {
  elements.hexInput.value = elements.colorPicker.value.toUpperCase();
}

function syncColorFromHex() {
  const value = elements.hexInput.value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    elements.colorPicker.value = value;
    elements.hexInput.value = value.toUpperCase();
  }
}

function parseHexColor(hex) {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16)
  ];
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function updateActionState() {
  elements.processButton.disabled = state.files.length === 0;
  elements.downloadAllButton.disabled = state.results.length === 0;
}

function setStatus(text) {
  elements.statusText.textContent = text;
}

function loadSelectedFiles(fileList) {
  const incoming = Array.from(fileList).filter(
    file => file.type === "image/png" || file.name.toLowerCase().endsWith(".png")
  );

  if (incoming.length === 0) {
    setStatus("PNG 파일만 처리할 수 있습니다.");
    return;
  }

  state.files = incoming;
  state.results.forEach(result => URL.revokeObjectURL(result.afterUrl));
  state.results = [];
  elements.resultsGrid.innerHTML = "";
  updateActionState();
  setStatus(`${incoming.length}개의 PNG 파일이 준비되었습니다. 처리 시작을 누르면 바로 결과를 만듭니다.`);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = error => {
      URL.revokeObjectURL(url);
      reject(error);
    };

    image.src = url;
  });
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampIndex(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function processImageData(imageData, targetColor, tolerance, feather, decontaminate, edgeErosion) {
  const source = imageData.data;
  const processed = new Uint8ClampedArray(source);
  const width = imageData.width;
  const height = imageData.height;
  const alpha = new Float32Array(width * height);
  const [tr, tg, tb] = targetColor;

  for (let i = 0; i < width * height; i += 1) {
    const idx = i * 4;
    const r = source[idx];
    const g = source[idx + 1];
    const b = source[idx + 2];
    const a = source[idx + 3];
    const distance = Math.max(Math.abs(r - tr), Math.abs(g - tg), Math.abs(b - tb));

    let alphaMult = 1;
    if (distance <= tolerance) {
      alphaMult = 0;
    } else if (feather > 0 && distance <= tolerance + feather) {
      alphaMult = (distance - tolerance) / feather;
    }

    if (feather > 0 && decontaminate && distance > tolerance && distance <= tolerance + feather && alphaMult < 1) {
      const tint = 1 - alphaMult;
      const denom = Math.max(1 - tint, 1e-6);
      processed[idx] = clamp((r - tint * tr) / denom);
      processed[idx + 1] = clamp((g - tint * tg) / denom);
      processed[idx + 2] = clamp((b - tint * tb) / denom);
    }

    alpha[i] = a * alphaMult;
  }

  if (edgeErosion > 0) {
    let current = alpha;
    for (let iter = 0; iter < edgeErosion; iter += 1) {
      const next = new Float32Array(width * height);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          let minAlpha = 255;
          for (let oy = -1; oy <= 1; oy += 1) {
            const sy = clampIndex(y + oy, 0, height - 1);
            for (let ox = -1; ox <= 1; ox += 1) {
              const sx = clampIndex(x + ox, 0, width - 1);
              const sample = current[sy * width + sx];
              if (sample < minAlpha) minAlpha = sample;
            }
          }
          next[y * width + x] = minAlpha;
        }
      }
      current = next;
    }
    alpha.set(current);
  }

  for (let i = 0; i < width * height; i += 1) {
    processed[i * 4 + 3] = clamp(alpha[i]);
  }

  return new ImageData(processed, width, height);
}

async function processFile(file, options) {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);

  const sourceImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const resultImageData = processImageData(
    sourceImageData,
    options.targetColor,
    options.tolerance,
    options.feather,
    options.decontaminate,
    options.edgeErosion
  );

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = canvas.width;
  outputCanvas.height = canvas.height;
  outputCanvas.getContext("2d").putImageData(resultImageData, 0, 0);

  const beforeUrl = await readFileAsDataUrl(file);
  const afterBlob = await new Promise(resolve => outputCanvas.toBlob(resolve, "image/png"));
  const afterUrl = URL.createObjectURL(afterBlob);

  return {
    fileName: file.name,
    originalSize: file.size,
    beforeUrl,
    afterUrl,
    afterBlob,
    width: image.width,
    height: image.height
  };
}

function appendSuffix(name, suffix) {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return `${name}${suffix}`;
  return `${name.slice(0, dot)}${suffix}${name.slice(dot)}`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderResults() {
  elements.resultsGrid.innerHTML = "";

  for (const result of state.results) {
    const node = elements.template.content.firstElementChild.cloneNode(true);
    node.querySelector(".file-name").textContent = result.fileName;
    node.querySelector(".file-meta").textContent = `${result.width} × ${result.height} · 원본 ${formatBytes(result.originalSize)}`;
    node.querySelector(".before-image").src = result.beforeUrl;
    node.querySelector(".after-image").src = result.afterUrl;
    node.querySelector(".download-button").addEventListener("click", () => {
      downloadBlob(result.afterBlob, appendSuffix(result.fileName, "-alpha"));
    });
    elements.resultsGrid.appendChild(node);
  }
}

async function processAll() {
  const targetColor = parseHexColor(elements.hexInput.value);
  const options = {
    targetColor,
    tolerance: Number(elements.toleranceInput.value),
    feather: Number(elements.featherInput.value),
    edgeErosion: Number(elements.erosionInput.value),
    decontaminate: elements.decontaminateInput.checked
  };

  state.results.forEach(result => URL.revokeObjectURL(result.afterUrl));
  state.results = [];
  updateActionState();

  for (let i = 0; i < state.files.length; i += 1) {
    const file = state.files[i];
    setStatus(`[${i + 1}/${state.files.length}] ${file.name} 처리 중...`);
    const result = await processFile(file, options);
    state.results.push(result);
    renderResults();
  }

  updateActionState();
  setStatus(`${state.results.length}개의 파일 처리가 끝났습니다. 각 카드에서 바로 다운로드할 수 있습니다.`);
}

function downloadAll() {
  state.results.forEach((result, index) => {
    setTimeout(() => {
      downloadBlob(result.afterBlob, appendSuffix(result.fileName, "-alpha"));
    }, index * 180);
  });
}

elements.selectButton.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", event => loadSelectedFiles(event.target.files));
elements.processButton.addEventListener("click", () => {
  processAll().catch(error => {
    console.error(error);
    setStatus("처리 중 오류가 발생했습니다. PNG 파일인지 다시 확인해 주세요.");
  });
});
elements.downloadAllButton.addEventListener("click", downloadAll);

elements.toleranceInput.addEventListener("input", syncSliderLabels);
elements.featherInput.addEventListener("input", syncSliderLabels);
elements.erosionInput.addEventListener("input", syncSliderLabels);
elements.colorPicker.addEventListener("input", syncColorFromPicker);
elements.hexInput.addEventListener("change", syncColorFromHex);

["dragenter", "dragover"].forEach(type => {
  elements.dropZone.addEventListener(type, event => {
    event.preventDefault();
    elements.dropZone.classList.add("is-active");
  });
});

["dragleave", "drop"].forEach(type => {
  elements.dropZone.addEventListener(type, event => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-active");
  });
});

elements.dropZone.addEventListener("drop", event => {
  loadSelectedFiles(event.dataTransfer.files);
});

syncSliderLabels();
syncColorFromPicker();
