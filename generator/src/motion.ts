export function initPageMotion() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;

  // 滚动进度：用 rAF 合并，避免 scroll 事件高频写样式触发重排
  let scrollScheduled = false;
  const writeScroll = () => {
    scrollScheduled = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? window.scrollY / max : 0;
    root.style.setProperty("--scroll-ratio", ratio.toFixed(4));
    document.querySelector(".site-header")?.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  const onScroll = () => {
    if (scrollScheduled) return;
    scrollScheduled = true;
    window.requestAnimationFrame(writeScroll);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  writeScroll();

  if (reduced) return;
  initScrollReveal();
}

function initScrollReveal() {
  const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (!targets.length) return;

  if (!("IntersectionObserver" in window)) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const node = entry.target as HTMLElement;
        node.animate(
          [
            { opacity: 1, transform: "translateY(10px)" },
            { opacity: 1, transform: "translateY(0)" }
          ],
          {
            duration: 520,
            easing: "cubic-bezier(.16, 1, .3, 1)",
            fill: "none"
          }
        );
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
  );

  targets.forEach((node) => observer.observe(node));
}
