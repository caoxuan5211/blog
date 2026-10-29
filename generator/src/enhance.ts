/**
 * Progressive enhancements applied to the rendered article DOM.
 * Runs after article commits and safely reapplies if React replaces
 * the contents of the dangerouslySetInnerHTML container.
 */
export function initContentEnhancements() {
  const manuscript = document.querySelector<HTMLElement>(".manuscript");
  if (!manuscript) return;
  enhanceCodeBlocks(manuscript);
  initHeadingAnchors(manuscript);
  initLightbox(manuscript);
}

function initHeadingAnchors(scope: HTMLElement) {
  scope.querySelectorAll<HTMLHeadingElement>("h2[id], h3[id], h4[id]").forEach((heading) => {
    if (heading.querySelector(".heading-anchor")) return;
    const anchor = document.createElement("a");
    anchor.className = "heading-anchor";
    anchor.href = `#${heading.id}`;
    anchor.textContent = "#";
    anchor.setAttribute("aria-label", `本节链接：${heading.textContent || heading.id}`);
    anchor.addEventListener("click", async () => {
      try {
        const url = new URL(`#${heading.id}`, window.location.href).href;
        await navigator.clipboard.writeText(url);
        anchor.classList.add("is-copied");
        window.setTimeout(() => anchor.classList.remove("is-copied"), 1200);
      } catch {
        /* 跳转本身仍然生效 */
      }
    });
    heading.append(anchor);
  });
}

function enhanceCodeBlocks(scope: HTMLElement) {
  scope.querySelectorAll<HTMLPreElement>("pre").forEach((pre, index) => {
    if (pre.closest(".code-block")) return;

    const wrap = document.createElement("div");
    wrap.className = "code-block";
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "button");
    wrap.setAttribute("aria-label", "复制代码");
    wrap.title = "点击复制代码";
    pre.removeAttribute("tabindex");
    if (!pre.id) {
      let codeId = `code-sample-${index + 1}`;
      while (document.getElementById(codeId)) codeId += "-";
      pre.id = codeId;
    }
    wrap.setAttribute("aria-describedby", pre.id);
    pre.replaceWith(wrap);
    wrap.append(pre);

    const status = document.createElement("span");
    status.className = "code-block__status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    wrap.append(status);

    let timer: number | undefined;
    const copyCode = async () => {
      const source = pre.querySelector("code")?.textContent ?? pre.textContent ?? "";
      wrap.classList.remove("is-copied", "is-copy-error");
      try {
        await navigator.clipboard.writeText(source);
        status.textContent = "已复制";
        wrap.classList.add("is-copied");
      } catch {
        status.textContent = "复制失败，请选择代码手动复制";
        wrap.classList.add("is-copy-error");
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        status.textContent = "";
        wrap.classList.remove("is-copied", "is-copy-error");
      }, 1600);
    };

    let pointerStart: { x: number; y: number; scrollLeft: number } | null = null;
    wrap.addEventListener("pointerdown", (event) => {
      pointerStart = event.isPrimary && event.button === 0
        ? { x: event.clientX, y: event.clientY, scrollLeft: pre.scrollLeft }
        : null;
    });
    wrap.addEventListener("pointercancel", () => { pointerStart = null; });
    wrap.addEventListener("click", (event) => {
      const start = pointerStart;
      pointerStart = null;
      const selection = window.getSelection();
      const selectingCode = selection && !selection.isCollapsed &&
        (wrap.contains(selection.anchorNode) || wrap.contains(selection.focusNode));
      const dragged = start && (
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6 ||
        Math.abs(pre.scrollLeft - start.scrollLeft) > 1
      );
      if (event.defaultPrevented || event.button !== 0 || selectingCode || dragged) return;
      void copyCode();
    });
    wrap.addEventListener("keydown", (event) => {
      if (event.target !== wrap) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        void copyCode();
      } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && pre.scrollWidth > pre.clientWidth) {
        event.preventDefault();
        pre.scrollBy({ left: event.key === "ArrowRight" ? 64 : -64 });
      }
    });
  });
}

function initLightbox(scope: HTMLElement) {
  const images = Array.from(scope.querySelectorAll<HTMLImageElement>("img")).filter(
    (img) => !img.closest("a")
  );
  if (!images.length || typeof HTMLDialogElement === "undefined") return;

  let dialog = document.querySelector<HTMLDialogElement>("dialog.lightbox");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.className = "lightbox";
    dialog.setAttribute("aria-label", "查看大图");
    dialog.append(document.createElement("img"));
    const currentDialog = dialog;
    dialog.addEventListener("click", () => currentDialog.close());
    document.body.append(dialog);
  }
  const currentDialog = dialog;
  const zoomed = currentDialog.querySelector("img");
  if (!zoomed) return;

  images.forEach((img) => {
    if (img.classList.contains("is-zoomable")) return;
    img.classList.add("is-zoomable");
    img.addEventListener("click", () => {
      zoomed.src = img.currentSrc || img.src;
      zoomed.alt = img.alt || "";
      currentDialog.showModal();
    });
  });
}
