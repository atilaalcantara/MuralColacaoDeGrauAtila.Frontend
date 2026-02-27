/**
 * floating-messages.js
 * Lane-based floating messages with guaranteed zero overlap.
 * Cards rise from bottom to top in vertical lanes with fade in/out.
 *
 * Architecture:
 *   - Screen is divided into N vertical lanes.
 *   - Each lane tracks when it becomes free (laneNextFreeAt[]).
 *   - A card is only spawned into a lane that is free, and the lane
 *     is then reserved for (cardHeight + GAP_Y) / speed seconds.
 *   - Hover/touch pauses the card and holds its lane.
 *   - On release, collision is checked; if overlap is detected the
 *     card gets an emergency fade-out instead of resuming.
 */

/* global performance */

const FloatingMessages = (() => {
  "use strict";

  // ==================== CONSTANTS ====================
  const SAFE_MARGIN_X = 16;
  const SAFE_MARGIN_Y = 16;
  const GAP_X = 16;
  const GAP_Y = 24;
  const SPEED_PX_PER_SEC = 50;
  const MAX_ACTIVE_MOBILE = 8;
  const MAX_ACTIVE_DESKTOP = 16;
  const SPAWN_JITTER_MS = 300;
  const FOCUS_HOLD_MS_MOBILE = 4000;
  const HOLD_EXTRA_MS = 2000;
  const EXIT_DURATION_MS = 300;
  const CARD_MIN_W = 220;
  const CARD_VW_RATIO = 0.28;
  const CARD_MAX_W = 360;
  const TICKER_BASE_MS = 700;
  const INITIAL_BURST_COUNT = 4;

  // ==================== MUTABLE STATE ====================
  var containerEl = null;
  var measureEl = null;
  var messageBuffer = [];
  var shuffledQueue = [];
  var queueIdx = 0;
  var activeItems = [];
  var laneNextFreeAt = [];
  var laneCount = 0;
  var cardW = 0;
  var laneW = 0;
  var tickTimer = null;
  var destroyed = false;
  var reducedMotion = false;
  var focusedItem = null;
  var focusSource = null; // "mouse" | "touch" | null

  // ==================== UTILITY FUNCTIONS ====================

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function escapeHtml(s) {
    var el = document.createElement("span");
    el.textContent = s;
    return el.innerHTML;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  // ==================== LANE CALCULATIONS ====================

  function calcCardW() {
    return clamp(CARD_VW_RATIO * window.innerWidth, CARD_MIN_W, CARD_MAX_W);
  }

  function recalcLanes() {
    var vw = window.innerWidth;
    cardW = calcCardW();
    var available = vw - 2 * SAFE_MARGIN_X;
    laneCount = Math.max(1, Math.floor(available / (cardW + GAP_X)));
    laneW = available / laneCount;

    while (laneNextFreeAt.length < laneCount) laneNextFreeAt.push(0);
    laneNextFreeAt.length = laneCount;
  }

  function xForLane(lane) {
    var vw = window.innerWidth;
    var base = SAFE_MARGIN_X + lane * laneW;
    var maxJitter = Math.max(0, laneW - cardW);
    var jitter = Math.random() * maxJitter;
    return clamp(base + jitter, SAFE_MARGIN_X, vw - SAFE_MARGIN_X - cardW);
  }

  // ==================== LANE HOLD ====================

  function holdLane(lane) {
    var now = performance.now();
    var current = laneNextFreeAt[lane] || 0;
    laneNextFreeAt[lane] = Math.max(current, now + HOLD_EXTRA_MS);
  }

  // ==================== HEIGHT MEASUREMENT ====================

  function ensureMeasureLayer() {
    if (measureEl) return;
    measureEl = document.createElement("div");
    measureEl.setAttribute("aria-hidden", "true");
    measureEl.style.cssText =
      "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;z-index:-1;";
    document.body.appendChild(measureEl);
  }

  function measureHeight(msg) {
    ensureMeasureLayer();
    var card = document.createElement("div");
    card.className = "floating-card";
    card.style.width = cardW + "px";
    card.style.position = "static";
    card.innerHTML = cardBodyHtml(msg);
    measureEl.appendChild(card);
    var h = card.getBoundingClientRect().height;
    measureEl.removeChild(card);
    return h;
  }

  function cardBodyHtml(msg) {
    var author = msg.name && msg.name.trim() ? msg.name.trim() : "An\u00F4nimo";
    return (
      '<div class="floating-card__body">' +
      '<p class="floating-card__text">\u201C' +
      escapeHtml(msg.message) +
      "\u201D</p>" +
      '<span class="floating-card__author">\u2014 ' +
      escapeHtml(author) +
      "</span>" +
      "</div>"
    );
  }

  // ==================== MESSAGE QUEUE ====================

  function nextMessage() {
    if (messageBuffer.length === 0) return null;
    if (queueIdx >= shuffledQueue.length) {
      shuffledQueue = shuffle(messageBuffer);
      queueIdx = 0;
    }
    return shuffledQueue[queueIdx++];
  }

  // ==================== ACTIVE LIMIT & SPEED ====================

  function maxActive() {
    var base =
      window.innerWidth <= 767 ? MAX_ACTIVE_MOBILE : MAX_ACTIVE_DESKTOP;
    return reducedMotion ? Math.max(2, Math.floor(base / 2)) : base;
  }

  function currentSpeed() {
    return reducedMotion ? SPEED_PX_PER_SEC * 0.6 : SPEED_PX_PER_SEC;
  }

  // ==================== COLLISION DETECTION ====================

  function intersects(elA, elB) {
    var a = elA.getBoundingClientRect();
    var b = elB.getBoundingClientRect();
    return !(
      a.right < b.left ||
      a.left > b.right ||
      a.bottom < b.top ||
      a.top > b.bottom
    );
  }

  function checkCollision(item) {
    for (var i = 0; i < activeItems.length; i++) {
      var other = activeItems[i];
      if (other === item) continue;
      if (other.removed) continue;
      if (other.lane !== item.lane) continue;
      if (intersects(item.el, other.el)) return true;
    }
    return false;
  }

  // ==================== EMERGENCY EXIT ====================

  function emergencyExit(item) {
    if (item.removed) return;
    item.removed = true;
    item.el.classList.add("floating-card--exit");
    setTimeout(function () {
      removeItem(item);
    }, EXIT_DURATION_MS);
  }

  function removeItem(item) {
    if (item.el && item.el.parentNode) {
      item.el.remove();
    }
    var idx = activeItems.indexOf(item);
    if (idx !== -1) activeItems.splice(idx, 1);
    if (focusedItem === item) {
      focusedItem = null;
      focusSource = null;
    }
  }

  // ==================== FOCUS MANAGEMENT ====================

  function setFocused(item, source) {
    // If another item is already focused, clear it first
    if (focusedItem && focusedItem !== item) {
      clearFocused(focusedItem);
    }

    focusedItem = item;
    focusSource = source;
    item.el.classList.add("floating-card--focused");
    holdLane(item.lane);
  }

  function clearFocused(item) {
    if (item.removed) return;

    item.el.classList.remove("floating-card--focused");

    // Collision check: if overlap detected, emergency exit this card
    if (checkCollision(item)) {
      emergencyExit(item);
    }

    if (focusedItem === item) {
      focusedItem = null;
      focusSource = null;
    }
  }

  // ==================== SPAWN LOGIC ====================

  function trySpawn() {
    if (destroyed) return;
    if (activeItems.length >= maxActive()) return;
    if (messageBuffer.length === 0) return;

    var now = performance.now();

    var free = [];
    for (var i = 0; i < laneCount; i++) {
      if (laneNextFreeAt[i] <= now) free.push(i);
    }
    if (free.length === 0) return;

    var lane = free[Math.floor(Math.random() * free.length)];

    var msg = nextMessage();
    if (!msg) return;

    var h = measureHeight(msg);
    var vh = window.innerHeight;
    var yStart = vh + SAFE_MARGIN_Y;
    var yEnd = -(h + SAFE_MARGIN_Y);
    var dist = yStart - yEnd;
    var spd = currentSpeed();
    var durSec = dist / spd;

    var reserveSec = (h + GAP_Y) / spd;
    laneNextFreeAt[lane] = now + reserveSec * 1000;

    createCard(msg, lane, h, yStart, yEnd, durSec);
  }

  function createCard(msg, lane, h, yStart, yEnd, durSec) {
    var x = xForLane(lane);

    var el = document.createElement("div");
    el.className = "floating-card";
    el.style.width = cardW + "px";
    el.style.left = x + "px";
    el.style.setProperty("--y-start", yStart + "px");
    el.style.setProperty("--y-end", yEnd + "px");
    el.style.setProperty("--anim-dur", durSec + "s");
    el.innerHTML = cardBodyHtml(msg);

    var item = { el: el, lane: lane, removed: false };
    activeItems.push(item);

    // ---- Desktop: mouseenter / mouseleave ----
    el.addEventListener("mouseenter", function () {
      if (item.removed) return;
      // Ignore mouse if a touch focus is active
      if (focusSource === "touch") return;
      setFocused(item, "mouse");
    });

    el.addEventListener("mouseleave", function () {
      if (item.removed) return;
      if (focusSource !== "mouse") return;
      if (focusedItem !== item) return;
      clearFocused(item);
    });

    // ---- Mobile: touchstart toggle with timeout ----
    if ("ontouchstart" in window) {
      var touchTimer = null;

      el.addEventListener(
        "touchstart",
        function (e) {
          if (item.removed) return;
          e.stopPropagation();

          // Toggle behavior: if already focused, clear it
          if (focusedItem === item && focusSource === "touch") {
            clearTimeout(touchTimer);
            clearFocused(item);
            return;
          }

          setFocused(item, "touch");

          // Auto-release after hold duration
          clearTimeout(touchTimer);
          touchTimer = setTimeout(function () {
            if (focusedItem === item) {
              clearFocused(item);
            }
          }, FOCUS_HOLD_MS_MOBILE);
        },
        { passive: false },
      );
    }

    // Cleanup when the main animation ends
    el.addEventListener("animationend", function handler(e) {
      if (e.animationName !== "float-move") return;
      el.removeEventListener("animationend", handler);
      if (item.removed) return;
      item.removed = true;
      el.remove();
      var idx = activeItems.indexOf(item);
      if (idx !== -1) activeItems.splice(idx, 1);
      if (focusedItem === item) {
        focusedItem = null;
        focusSource = null;
      }
    });

    containerEl.appendChild(el);
  }

  // ==================== SCHEDULER / TICKER ====================

  function startTicker() {
    if (tickTimer) return;
    var interval = reducedMotion ? TICKER_BASE_MS * 2 : TICKER_BASE_MS;

    function loop() {
      if (destroyed) return;
      trySpawn();
      tickTimer = setTimeout(loop, interval + Math.random() * SPAWN_JITTER_MS);
    }

    loop();
  }

  function stopTicker() {
    clearTimeout(tickTimer);
    tickTimer = null;
  }

  // ==================== RESIZE HANDLING ====================

  var resizeDebounce = null;

  function onResize() {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(recalcLanes, 200);
  }

  // ==================== VISIBILITY HANDLING ====================

  function onVisibilityChange() {
    if (destroyed) return;
    if (document.hidden) {
      stopTicker();
    } else if (messageBuffer.length > 0) {
      startTicker();
    }
  }

  // ==================== PUBLIC API ====================

  function init(container) {
    containerEl = container;
    destroyed = false;
    focusedItem = null;
    focusSource = null;
    reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    recalcLanes();
    ensureMeasureLayer();

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  function setMessages(msgs) {
    var isFirstLoad = messageBuffer.length === 0 && msgs.length > 0;
    messageBuffer = msgs;
    shuffledQueue = shuffle(msgs);
    queueIdx = 0;

    if (msgs.length > 0 && !tickTimer && !destroyed) {
      startTicker();
    }

    if (isFirstLoad && !destroyed) {
      var burst = Math.min(INITIAL_BURST_COUNT, maxActive());
      for (var i = 0; i < burst; i++) {
        (function (delay) {
          setTimeout(function () {
            trySpawn();
          }, delay);
        })(i * 400);
      }
    }
  }

  function destroy() {
    destroyed = true;
    stopTicker();
    focusedItem = null;
    focusSource = null;
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    clearTimeout(resizeDebounce);

    activeItems.forEach(function (it) {
      if (it.el && it.el.parentNode) it.el.remove();
    });
    activeItems = [];
    laneNextFreeAt = [];

    if (measureEl && measureEl.parentNode) {
      measureEl.parentNode.removeChild(measureEl);
      measureEl = null;
    }
  }

  return { init: init, setMessages: setMessages, destroy: destroy };
})();
