/* Состояние панели и его запись.
 *
 * Здесь живёт вся «подключённость к данным»: хранилище, пересчёт баланса и
 * журнала в момент внесения, выгрузка покупки бухгалтеру.
 *
 * Куда уходит покупка
 * ───────────────────
 * Бэкенд-контракт с экраном бухгалтера «Финансы дня» → «Баланс Шох» пока не
 * подтверждён (T-007 → «Зависимости»), поэтому запись идёт через адаптер
 * Ledger с одной точкой подмены:
 *
 *   1. всегда — в общий журнал localStorage (`rv:ledger:v1`), его читает
 *      экран бухгалтера, когда работает в том же браузере;
 *   2. если задан RVConfig.apiBase — дополнительно POST-ом в API, с очередью
 *      и повтором, чтобы обрыв сети посреди закупа ничего не терял.
 *
 * Когда контракт подтвердят — меняется только Ledger.push и форма события
 * ниже, остальному приложению эта разница не видна.
 */
(function (root, factory) {
  var api = factory(root.RVCore, root.RVData);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RVStore = api;
})(typeof self !== 'undefined' ? self : globalThis, function (core, data) {
  'use strict';

  var KEY = 'rv:zakup:v1';
  var PHOTO_KEY = 'rv:zakup:photos:v1';
  var LEDGER_KEY = 'rv:ledger:v1';
  var OUTBOX_KEY = 'rv:zakup:outbox:v1';

  var config = (typeof self !== 'undefined' && self.RVConfig) || {};

  // ── Доступ к localStorage, устойчивый к приватному режиму ────────────────

  function ls() {
    try {
      var s = self.localStorage;
      s.setItem('rv:probe', '1');
      s.removeItem('rv:probe');
      return s;
    } catch (e) {
      return null;
    }
  }

  var memory = {};

  function readRaw(key) {
    var s = ls();
    if (!s) return memory[key] == null ? null : memory[key];
    return s.getItem(key);
  }

  function writeRaw(key, value) {
    var s = ls();
    if (!s) { memory[key] = value; return true; }
    try {
      s.setItem(key, value);
      return true;
    } catch (e) {
      return false; // чаще всего — переполнение квоты фотографиями
    }
  }

  function readJson(key, fallback) {
    var raw = readRaw(key);
    if (!raw) return fallback;
    try {
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    return writeRaw(key, JSON.stringify(value));
  }

  // ── Фотографии ───────────────────────────────────────────────────────────
  // Лежат отдельно от состояния: они тяжёлые, и при нехватке места мы жертвуем
  // самыми старыми снимками, а не журналом покупок.

  var MAX_PHOTOS = 40;

  function photos() {
    return readJson(PHOTO_KEY, {});
  }

  function savePhoto(id, dataUrl) {
    var all = photos();
    all[id] = dataUrl;

    // Держим не больше MAX_PHOTOS — снимки старых покупок вытесняются первыми.
    var ids = Object.keys(all);
    while (ids.length > MAX_PHOTOS) {
      delete all[ids.shift()];
    }

    var ok = writeJson(PHOTO_KEY, all);
    while (!ok) {
      var keys = Object.keys(all);
      // Последним выбрасываем текущий снимок: если и он не влез — места нет совсем.
      if (keys.length <= 1) return false;
      delete all[keys[0] === id ? keys[1] : keys[0]];
      ok = writeJson(PHOTO_KEY, all);
    }
    return ok;
  }

  function getPhoto(id) {
    if (!id) return null;
    return photos()[id] || null;
  }

  // ── Состояние ────────────────────────────────────────────────────────────

  function emptyState(now) {
    var s = data.seed(now || new Date());
    return {
      version: 1,
      issued: s.issued,
      transfers: s.transfers,
      purchases: [],
      trips: [],
      questsClaimed: {},   // { '2026-09-28': ['three', ...] }
      trip: null           // текущий незавершённый закуп
    };
  }

  var state = null;

  function load() {
    if (state) return state;
    state = readJson(KEY, null);
    if (!state || state.version !== 1) {
      state = emptyState();
      persist();
    }
    // Подстраховка на случай правки хранилища руками.
    ['issued', 'transfers', 'purchases', 'trips'].forEach(function (k) {
      if (!Array.isArray(state[k])) state[k] = [];
    });
    if (!state.questsClaimed || typeof state.questsClaimed !== 'object') state.questsClaimed = {};
    return state;
  }

  function persist() {
    writeJson(KEY, state);
  }

  function reset() {
    state = emptyState();
    persist();
    writeJson(PHOTO_KEY, {});
    writeJson(LEDGER_KEY, []);
    writeJson(OUTBOX_KEY, []);
    return state;
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  // ── Выгрузка бухгалтеру ──────────────────────────────────────────────────

  var Ledger = {
    /** Событие покупки в форме, которую ждёт «Баланс Шох». */
    event: function (p) {
      return {
        id: p.id,
        type: 'purchase',
        actor: 'shoh',
        at: p.at,
        pointId: p.pointId,
        point: p.pointName,
        itemId: p.itemId,
        item: p.itemName,
        unit: p.unit,
        qty: p.qty,
        unitPrice: Math.round(p.unitPrice),
        total: p.total,
        hasPhoto: !!p.hasPhoto,
        photoId: p.photoId || null,
        flags: [].concat(
          p.hasPhoto ? [] : ['no_photo'],
          p.priceHigh ? ['price_high'] : [],
          p.overBalance ? ['over_balance'] : []
        ),
        tripId: p.tripId
      };
    },

    push: function (p) {
      var ev = Ledger.event(p);
      var feed = readJson(LEDGER_KEY, []);
      if (!feed.some(function (e) { return e.id === ev.id; })) {
        feed.push(ev);
        writeJson(LEDGER_KEY, feed);
      }
      if (config.apiBase) Ledger.enqueue(ev);
      return ev;
    },

    // Очередь на отправку: покупка уже записана локально, сеть догонит.
    enqueue: function (ev) {
      var box = readJson(OUTBOX_KEY, []);
      if (!box.some(function (e) { return e.id === ev.id; })) {
        box.push(ev);
        writeJson(OUTBOX_KEY, box);
      }
      Ledger.flush();
    },

    pending: function () {
      return readJson(OUTBOX_KEY, []).length;
    },

    flush: function () {
      if (!config.apiBase || typeof fetch !== 'function') return Promise.resolve(0);
      var box = readJson(OUTBOX_KEY, []);
      if (!box.length) return Promise.resolve(0);
      var sent = [];
      return box.reduce(function (chain, ev) {
        return chain.then(function () {
          return fetch(config.apiBase.replace(/\/$/, '') + '/shoh/purchases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': ev.id },
            body: JSON.stringify(ev)
          }).then(function (r) {
            if (r.ok || r.status === 409) sent.push(ev.id); // 409 — уже принято
          }).catch(function () { /* остаётся в очереди до следующей попытки */ });
        });
      }, Promise.resolve()).then(function () {
        if (sent.length) {
          writeJson(OUTBOX_KEY, readJson(OUTBOX_KEY, []).filter(function (e) {
            return sent.indexOf(e.id) === -1;
          }));
        }
        return sent.length;
      });
    }
  };

  // ── Производные величины ─────────────────────────────────────────────────

  function balance() {
    var s = load();
    return core.balance(s.issued, s.purchases);
  }

  function questsToday(now) {
    var s = load();
    return core.todayQuests(s.purchases, s.trips, now || new Date());
  }

  function xpTotal(now) {
    var s = load();
    var xp = 0;
    s.purchases.forEach(function (p) { xp += Number(p.xp) || 0; });
    s.trips.forEach(function (t) { xp += Number(t.bonusXp) || 0; });
    Object.keys(s.questsClaimed).forEach(function (day) {
      xp += (s.questsClaimed[day] || []).length * core.XP.QUEST;
    });
    return xp;
  }

  /** Начисляет опыт за задания, которые только что стали выполненными. */
  function settleQuests(now) {
    var s = load();
    var today = now || new Date();
    var key = core.dayKey(today);
    var claimed = s.questsClaimed[key] || [];
    var fresh = [];
    questsToday(today).forEach(function (q) {
      if (q.done && claimed.indexOf(q.id) === -1) { claimed.push(q.id); fresh.push(q); }
    });
    if (fresh.length) {
      s.questsClaimed[key] = claimed;
      persist();
    }
    return fresh;
  }

  function level(now) {
    return core.levelInfo(xpTotal(now));
  }

  // ── Закуп ────────────────────────────────────────────────────────────────

  /** Таймер считается от метки времени, а не тиками: переживает сворачивание и перезагрузку. */
  function elapsedSec(now) {
    var s = load();
    if (!s.trip) return 0;
    return Math.max(0, Math.floor(((now ? now.getTime() : Date.now()) - s.trip.startedAt) / 1000));
  }

  function startTrip(now) {
    var s = load();
    if (!s.trip) {
      s.trip = { id: uid('trip'), startedAt: (now || new Date()).getTime(), purchaseIds: [] };
      persist();
    }
    return s.trip;
  }

  function cancelTrip() {
    var s = load();
    // Покупки уже внесены и остаются; отменяется только незакрытый закуп.
    if (s.trip && s.trip.purchaseIds.length) return finishTrip();
    s.trip = null;
    persist();
    return null;
  }

  function finishTrip(now) {
    var s = load();
    if (!s.trip) return null;
    var elapsed = elapsedSec(now);
    var ids = s.trip.purchaseIds.slice();
    var bonus = ids.length ? core.tripBonusXp(elapsed) : 0;
    var trip = {
      id: s.trip.id,
      startedAt: new Date(s.trip.startedAt).toISOString(),
      finishedAt: (now || new Date()).toISOString(),
      elapsedSec: elapsed,
      purchaseIds: ids,
      bonusXp: bonus
    };
    s.trips.push(trip);
    s.trip = null;
    persist();
    settleQuests(now);
    return trip;
  }

  function tripPurchases(trip) {
    var s = load();
    var ids = (trip && trip.purchaseIds) || [];
    return s.purchases.filter(function (p) { return ids.indexOf(p.id) !== -1; });
  }

  /**
   * Внесение покупки. Возвращает { purchase, xp, balanceBefore, balanceAfter, quests }.
   * Баланс, журнал и проверки пересчитываются здесь же — экран только перерисовывается.
   *
   * draft: { pointId, pointName, itemId, itemName, custom, unit, qty, price, priceMode,
   *          photoDataUrl, avgPrice, clientKey }
   */
  function addPurchase(draft, now) {
    var s = load();
    var at = now || new Date();

    // Повторное нажатие «Подтвердить» не должно записать покупку дважды.
    if (draft.clientKey) {
      var dup = s.purchases.filter(function (p) { return p.clientKey === draft.clientKey; })[0];
      if (dup) return { purchase: dup, duplicate: true, xp: { total: dup.xp, parts: dup.xpParts }, quests: [] };
    }

    var line = core.computeLine(draft.qty, draft.price, draft.priceMode);
    if (!line.valid) throw new Error('Некорректное количество или цена');

    var before = core.balance(s.issued, s.purchases);
    var priceHigh = core.isPriceHigh(line.unitPrice, draft.avgPrice);
    var hasPhoto = !!draft.photoDataUrl;
    var xp = core.purchaseXp({ hasPhoto: hasPhoto, priceHigh: priceHigh });

    var id = uid('pur');
    var photoId = null;
    if (hasPhoto) {
      photoId = id;
      if (!savePhoto(photoId, draft.photoDataUrl)) { photoId = null; hasPhoto = false; }
    }

    var purchase = {
      id: id,
      clientKey: draft.clientKey || null,
      tripId: s.trip ? s.trip.id : null,
      at: at.toISOString(),
      pointId: draft.pointId,
      pointName: draft.pointName,
      itemId: draft.itemId || null,
      itemName: draft.itemName,
      custom: !!draft.custom,
      unit: draft.unit,
      qty: line.qty,
      priceMode: draft.priceMode,
      unitPrice: line.unitPrice,
      total: line.total,
      hasPhoto: hasPhoto,
      photoId: photoId,
      priceHigh: priceHigh,
      overBalance: line.total > before.onHand,
      xp: xp.total,
      xpParts: xp.parts
    };

    s.purchases.push(purchase);
    if (s.trip) s.trip.purchaseIds.push(purchase.id);
    persist();

    Ledger.push(purchase);
    var quests = settleQuests(at);

    return {
      purchase: purchase,
      duplicate: false,
      xp: xp,
      balanceBefore: before.onHand,
      balanceAfter: core.balance(s.issued, s.purchases).onHand,
      quests: quests
    };
  }

  function recent(n) {
    var s = load();
    return s.purchases.slice().sort(function (a, b) {
      return new Date(b.at) - new Date(a.at);
    }).slice(0, n || 5);
  }

  function ledger() {
    return readJson(LEDGER_KEY, []);
  }

  return {
    KEY: KEY,
    LEDGER_KEY: LEDGER_KEY,
    config: config,
    load: load,
    reset: reset,
    persist: persist,
    balance: balance,
    level: level,
    xpTotal: xpTotal,
    questsToday: questsToday,
    settleQuests: settleQuests,
    startTrip: startTrip,
    finishTrip: finishTrip,
    cancelTrip: cancelTrip,
    tripPurchases: tripPurchases,
    elapsedSec: elapsedSec,
    addPurchase: addPurchase,
    recent: recent,
    getPhoto: getPhoto,
    ledger: ledger,
    Ledger: Ledger,
    uid: uid
  };
});
