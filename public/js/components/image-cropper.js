/**
 * ==============================================================================
 * RIMUBUSCA - COMPONENTE INTERATIVO DE RECORTE FACIAL (IMAGE-CROPPER.JS)
 * Permite selecionar formas geométricas (Quadrado 1:1, Retrato 3:4, Círculo,
 * Oval ou Retângulo Livre), mover e redimensionar via mouse/touch e exportar
 * apenas a região selecionada via HTML5 Canvas para economizar banda/espaço.
 * ==============================================================================
 */
(function (global) {
  "use strict";

  const SHAPES = {
    square: { label: "Quadrado (1:1)", ratio: 1, rounded: false },
    portrait: { label: "Retrato (3:4)", ratio: 3 / 4, rounded: false },
    circle: { label: "Círculo (1:1)", ratio: 1, rounded: true },
    oval: { label: "Oval (3:4)", ratio: 3 / 4, rounded: true },
    free: { label: "Retângulo Livre", ratio: null, rounded: false },
  };

  const MIN_CROP_SIZE = 28;
  const MAX_EXPORT_DIM = 1024;

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  class RimuImageCropper {
    /**
     * @param {Object} opts
     * @param {HTMLElement} opts.stageEl Container posicionado sobre a imagem
     * @param {HTMLImageElement} opts.imgEl Elemento <img> visível no stage
     * @param {HTMLElement} opts.selectionEl Caixa de seleção sobreposta (.osint-crop-selection)
     * @param {Function} [opts.onChange] Callback ao mover/redimensionar/trocar forma
     */
    constructor({ stageEl, imgEl, selectionEl, onChange } = {}) {
      this.stageEl = stageEl;
      this.imgEl = imgEl;
      this.selectionEl = selectionEl;
      this.onChange = typeof onChange === "function" ? onChange : null;

      this.shape = "square";
      this.box = { x: 0, y: 0, width: 120, height: 120 };
      this.stageRect = { width: 0, height: 0 };
      this.sourceFile = null;
      this.objectUrl = null;
      this.dragState = null;

      this._onPointerDown = this._handlePointerDown.bind(this);
      this._onPointerMove = this._handlePointerMove.bind(this);
      this._onPointerUp = this._handlePointerUp.bind(this);
      this._onResize = () => {
        const prevW = this.stageRect.width;
        const prevH = this.stageRect.height;
        this.measureStage();
        if (prevW > 0 && prevH > 0 && this.stageRect.width > 0 && this.stageRect.height > 0) {
          const sx = this.stageRect.width / prevW;
          const sy = this.stageRect.height / prevH;
          this.setBox({
            x: this.box.x * sx,
            y: this.box.y * sy,
            width: this.box.width * sx,
            height: this.box.height * sy,
          });
        }
      };

      if (this.stageEl) {
        this.stageEl.addEventListener("pointerdown", this._onPointerDown);
      }
      if (typeof global.addEventListener === "function") {
        global.addEventListener("pointermove", this._onPointerMove);
        global.addEventListener("pointerup", this._onPointerUp);
        global.addEventListener("pointercancel", this._onPointerUp);
        global.addEventListener("resize", this._onResize);
      }
    }

    static get SHAPES() {
      return SHAPES;
    }

    measureStage() {
      if (!this.imgEl) return { width: 0, height: 0 };
      const rect = this.imgEl.getBoundingClientRect();
      this.stageRect = {
        width: rect.width || this.imgEl.clientWidth || 0,
        height: rect.height || this.imgEl.clientHeight || 0,
      };
      return this.stageRect;
    }

    async loadFile(file) {
      if (!file) return;
      this.sourceFile = file;
      if (this.objectUrl) {
        try {
          URL.revokeObjectURL(this.objectUrl);
        } catch {}
        this.objectUrl = null;
      }

      const url = URL.createObjectURL(file);
      this.objectUrl = url;

      await new Promise((resolve, reject) => {
        const onLoad = () => {
          cleanup();
          resolve();
        };
        const onErr = (e) => {
          cleanup();
          reject(e);
        };
        const cleanup = () => {
          this.imgEl.removeEventListener("load", onLoad);
          this.imgEl.removeEventListener("error", onErr);
        };
        this.imgEl.addEventListener("load", onLoad);
        this.imgEl.addEventListener("error", onErr);
        this.imgEl.src = url;
      });

      this.measureStage();
      this.resetSelection();
    }

    setShape(shapeKey) {
      const cfg = SHAPES[shapeKey] || SHAPES.square;
      this.shape = SHAPES[shapeKey] ? shapeKey : "square";
      if (this.selectionEl) {
        this.selectionEl.classList.toggle("is-rounded", Boolean(cfg.rounded));
      }
      this.measureStage();
      if (this.stageRect.width > 0 && this.stageRect.height > 0) {
        if (cfg.ratio) {
          const cx = this.box.x + this.box.width / 2;
          const cy = this.box.y + this.box.height / 2;
          let w = this.box.width;
          let h = w / cfg.ratio;
          if (h > this.stageRect.height) {
            h = this.stageRect.height * 0.85;
            w = h * cfg.ratio;
          }
          if (w > this.stageRect.width) {
            w = this.stageRect.width * 0.85;
            h = w / cfg.ratio;
          }
          this.setBox({ x: cx - w / 2, y: cy - h / 2, width: w, height: h });
        } else {
          this.renderSelection();
        }
      } else {
        this.emitChange();
      }
    }

    resetSelection() {
      this.measureStage();
      const sw = this.stageRect.width;
      const sh = this.stageRect.height;
      if (!sw || !sh) return;

      const cfg = SHAPES[this.shape] || SHAPES.square;
      let w = sw * 0.68;
      let h = cfg.ratio ? w / cfg.ratio : sh * 0.68;

      if (h > sh * 0.82) {
        h = sh * 0.82;
        w = cfg.ratio ? h * cfg.ratio : w;
      }
      if (w > sw * 0.82) {
        w = sw * 0.82;
        h = cfg.ratio ? w / cfg.ratio : h;
      }

      this.setBox({
        x: (sw - w) / 2,
        y: (sh - h) / 2,
        width: Math.max(MIN_CROP_SIZE, w),
        height: Math.max(MIN_CROP_SIZE, h),
      });
    }

    setBox(next) {
      this.measureStage();
      const sw = this.stageRect.width;
      const sh = this.stageRect.height;
      if (!sw || !sh) return;

      let w = clamp(next.width, Math.min(MIN_CROP_SIZE, sw), sw);
      let h = clamp(next.height, Math.min(MIN_CROP_SIZE, sh), sh);
      const x = clamp(next.x, 0, Math.max(0, sw - w));
      const y = clamp(next.y, 0, Math.max(0, sh - h));

      this.box = { x, y, width: w, height: h };
      this.renderSelection();
    }

    renderSelection() {
      if (!this.selectionEl) return;
      const cfg = SHAPES[this.shape] || SHAPES.square;
      this.selectionEl.style.left = `${this.box.x}px`;
      this.selectionEl.style.top = `${this.box.y}px`;
      this.selectionEl.style.width = `${this.box.width}px`;
      this.selectionEl.style.height = `${this.box.height}px`;
      this.selectionEl.classList.toggle("is-rounded", Boolean(cfg.rounded));
      this.emitChange();
    }

    getNaturalCropRect() {
      const sw = this.stageRect.width || 1;
      const sh = this.stageRect.height || 1;
      const nw = this.imgEl?.naturalWidth || sw;
      const nh = this.imgEl?.naturalHeight || sh;
      const scaleX = nw / sw;
      const scaleY = nh / sh;

      const x = Math.max(0, Math.round(this.box.x * scaleX));
      const y = Math.max(0, Math.round(this.box.y * scaleY));
      const width = Math.min(nw - x, Math.max(1, Math.round(this.box.width * scaleX)));
      const height = Math.min(nh - y, Math.max(1, Math.round(this.box.height * scaleY)));

      return { x, y, width, height, naturalWidth: nw, naturalHeight: nh };
    }

    emitChange() {
      if (!this.onChange) return;
      const cfg = SHAPES[this.shape] || SHAPES.square;
      const natural = this.getNaturalCropRect();
      this.onChange({
        shape: this.shape,
        shapeLabel: cfg.label,
        rounded: Boolean(cfg.rounded),
        ...natural,
      });
    }

    _handlePointerDown(e) {
      if (!this.stageEl || !this.imgEl) return;
      this.measureStage();
      const sw = this.stageRect.width;
      const sh = this.stageRect.height;
      if (!sw || !sh) return;

      const handleEl = e.target.closest?.("[data-crop-handle]");
      const insideSelection = e.target.closest?.(".osint-crop-selection");
      const stageBounds = this.imgEl.getBoundingClientRect();
      const px = clamp(e.clientX - stageBounds.left, 0, sw);
      const py = clamp(e.clientY - stageBounds.top, 0, sh);

      e.preventDefault();

      if (handleEl) {
        this.dragState = {
          mode: "resize",
          handle: handleEl.getAttribute("data-crop-handle"),
          startX: px,
          startY: py,
          startBox: { ...this.box },
        };
      } else if (insideSelection) {
        this.dragState = {
          mode: "move",
          startX: px,
          startY: py,
          startBox: { ...this.box },
        };
      } else {
        this.dragState = {
          mode: "draw",
          originX: px,
          originY: py,
        };
      }
    }

    _handlePointerMove(e) {
      if (!this.dragState || !this.imgEl) return;
      const sw = this.stageRect.width;
      const sh = this.stageRect.height;
      if (!sw || !sh) return;

      const stageBounds = this.imgEl.getBoundingClientRect();
      const px = clamp(e.clientX - stageBounds.left, 0, sw);
      const py = clamp(e.clientY - stageBounds.top, 0, sh);
      const cfg = SHAPES[this.shape] || SHAPES.square;
      const ratio = cfg.ratio;

      if (this.dragState.mode === "move") {
        const dx = px - this.dragState.startX;
        const dy = py - this.dragState.startY;
        const nextX = clamp(this.dragState.startBox.x + dx, 0, sw - this.dragState.startBox.width);
        const nextY = clamp(this.dragState.startBox.y + dy, 0, sh - this.dragState.startBox.height);
        this.box = { ...this.dragState.startBox, x: nextX, y: nextY };
        this.renderSelection();
        return;
      }

      if (this.dragState.mode === "draw") {
        let x1 = this.dragState.originX;
        let y1 = this.dragState.originY;
        let x2 = px;
        let y2 = py;

        let w = Math.abs(x2 - x1);
        let h = Math.abs(y2 - y1);
        if (ratio) {
          h = w / ratio;
        }
        const maxW = x2 >= x1 ? sw - x1 : x1;
        const maxH = y2 >= y1 ? sh - y1 : y1;
        if (w > maxW) {
          w = maxW;
          if (ratio) h = w / ratio;
        }
        if (h > maxH) {
          h = maxH;
          if (ratio) w = h * ratio;
        }
        if (w < MIN_CROP_SIZE && h < MIN_CROP_SIZE) return;

        const left = x2 >= x1 ? x1 : x1 - w;
        const top = y2 >= y1 ? y1 : y1 - h;
        this.box = { x: clamp(left, 0, sw - w), y: clamp(top, 0, sh - h), width: w, height: h };
        this.renderSelection();
        return;
      }

      if (this.dragState.mode === "resize") {
        const b = this.dragState.startBox;
        const hnd = this.dragState.handle;
        let left = b.x;
        let top = b.y;
        let right = b.x + b.width;
        let bottom = b.y + b.height;

        if (hnd.includes("w")) left = Math.min(px, right - MIN_CROP_SIZE);
        if (hnd.includes("e")) right = Math.max(px, left + MIN_CROP_SIZE);
        if (hnd.includes("n")) top = Math.min(py, bottom - MIN_CROP_SIZE);
        if (hnd.includes("s")) bottom = Math.max(py, top + MIN_CROP_SIZE);

        let w = right - left;
        let h = bottom - top;

        if (ratio) {
          if (hnd === "n" || hnd === "s") {
            w = h * ratio;
            const cx = b.x + b.width / 2;
            left = clamp(cx - w / 2, 0, Math.max(0, sw - w));
            right = left + w;
          } else {
            h = w / ratio;
            if (hnd.includes("n")) {
              top = bottom - h;
            } else if (hnd === "e" || hnd === "w") {
              const cy = b.y + b.height / 2;
              top = cy - h / 2;
              bottom = top + h;
            } else {
              bottom = top + h;
            }
          }

          if (top < 0) {
            bottom -= top;
            top = 0;
          }
          if (bottom > sh) {
            const overflow = bottom - sh;
            top = Math.max(0, top - overflow);
            h = Math.min(h, sh - top);
            w = h * ratio;
            if (hnd.includes("w")) left = right - w;
          }
          if (left < 0) {
            left = 0;
            if (hnd.includes("w")) {
              w = right;
              h = w / ratio;
              if (hnd.includes("n")) top = bottom - h;
            }
          }
          if (left + w > sw) {
            w = sw - left;
            h = w / ratio;
            if (hnd.includes("n")) top = bottom - h;
          }
        }

        this.box = {
          x: clamp(left, 0, sw - MIN_CROP_SIZE),
          y: clamp(top, 0, sh - MIN_CROP_SIZE),
          width: clamp(w, MIN_CROP_SIZE, sw - clamp(left, 0, sw)),
          height: clamp(h, MIN_CROP_SIZE, sh - clamp(top, 0, sh)),
        };
        this.renderSelection();
      }
    }

    _handlePointerUp() {
      this.dragState = null;
    }

    /**
     * Exporta apenas a área recortada (com máscara circular/oval se selecionada)
     * em arquivo JPEG otimizado pronto para envio via FormData.
     */
    async exportCroppedFile(quality = 0.9) {
      if (!this.imgEl || !this.imgEl.naturalWidth) {
        throw new Error("Nenhuma imagem carregada para recorte.");
      }
      const { x, y, width, height } = this.getNaturalCropRect();
      const cfg = SHAPES[this.shape] || SHAPES.square;

      const scale = Math.min(1, MAX_EXPORT_DIM / Math.max(width, height));
      const outW = Math.max(1, Math.round(width * scale));
      const outH = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, outW, outH);

      ctx.save();
      if (cfg.rounded) {
        ctx.beginPath();
        ctx.ellipse(outW / 2, outH / 2, outW / 2, outH / 2, 0, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
      }
      ctx.drawImage(this.imgEl, x, y, width, height, 0, 0, outW, outH);
      ctx.restore();

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar recorte da imagem."))),
          "image/jpeg",
          quality
        );
      });

      const baseName = String(this.sourceFile?.name || "rosto.jpg").replace(/\.[^.]+$/, "");
      return new File([blob], `${baseName}_recorte.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    }

    destroy() {
      if (this.stageEl) {
        this.stageEl.removeEventListener("pointerdown", this._onPointerDown);
      }
      if (typeof global.removeEventListener === "function") {
        global.removeEventListener("pointermove", this._onPointerMove);
        global.removeEventListener("pointerup", this._onPointerUp);
        global.removeEventListener("pointercancel", this._onPointerUp);
        global.removeEventListener("resize", this._onResize);
      }
      if (this.objectUrl) {
        try {
          URL.revokeObjectURL(this.objectUrl);
        } catch {}
        this.objectUrl = null;
      }
    }
  }

  global.RimuImageCropper = RimuImageCropper;
})(typeof window !== "undefined" ? window : globalThis);
