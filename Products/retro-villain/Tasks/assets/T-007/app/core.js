/* Закуп · Шох — чистые функции предметной области.
 * Ни DOM, ни localStorage, ни сети. Всё, что здесь, покрыто tests.js
 * и одинаково работает в браузере и в Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RVCore = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  // ── Правила начисления опыта ─────────────────────────────────────────────
  // Значения — как в прототипе (T-007, п. 18).
  var XP = {
    PURCHASE: 20,       // за каждую внесённую покупку
    PHOTO: 10,          // за фото товара или чека
    NO_PHOTO: -10,      // штраф, если фото не приложили
    FAIR_PRICE: 10,     // цена в пределах обычной
    TRIP_IN_TIME: 50,   // закуп уложился в лимит
    QUEST: 30           // за выполненное задание на сегодня
  };

  var TRIP_LIMIT_SEC = 15 * 60; // «Уложитесь в 15 минут»

  // Порог «цена выше обычной»: дороже обычной более чем на 20 %.
  // ВНИМАНИЕ: значение предварительное — согласовать с бухгалтером (T-007 → «Зависимости»).
  var PRICE_WARN_RATIO = 1.2;

  var LEVELS = [
    { lvl: 1, title: 'Новичок закупа', min: 0 },
    { lvl: 2, title: 'Знаток рынка', min: 300 },
    { lvl: 3, title: 'Мастер закупа', min: 800 },
    { lvl: 4, title: 'Хозяин рынка', min: 1500 },
    { lvl: 5, title: 'Легенда закупа', min: 2500 }
  ];

  var UNITS = [
    { id: 'kg', label: 'кг', fractional: true, step: 0.5, quick: [1, 5, 10] },
    { id: 'pc', label: 'шт', fractional: false, step: 1, quick: [5, 10, 20] },
    { id: 'l', label: 'л', fractional: true, step: 0.5, quick: [1, 5, 10] },
    { id: 'pack', label: 'упак', fractional: false, step: 1, quick: [1, 3, 6] }
  ];

  function unitById(id) {
    for (var i = 0; i < UNITS.length; i++) if (UNITS[i].id === id) return UNITS[i];
    return UNITS[0];
  }

  // ── Деньги и числа ───────────────────────────────────────────────────────

  var NBSP = ' ';

  /** 1250000 → «1 250 000» (неразрывные пробелы, как принято в русских суммах). */
  function formatSum(n) {
    var v = Math.round(Number(n) || 0);
    var sign = v < 0 ? '−' : '';
    var s = String(Math.abs(v));
    var out = '';
    while (s.length > 3) {
      out = NBSP + s.slice(-3) + out;
      s = s.slice(0, -3);
    }
    return sign + s + out;
  }

  /** Количество: целое без хвоста, дробное — до 3 знаков, запятая как разделитель. */
  function formatQty(n) {
    var v = Number(n) || 0;
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 1000) / 1000).replace('.', ',');
  }

  /** Разбор пользовательского ввода: «1 250,5» / «1250.5» → 1250.5. NaN → 0. */
  function parseNum(raw) {
    if (typeof raw === 'number') return isFinite(raw) ? raw : 0;
    var s = String(raw == null ? '' : raw)
      .replace(/[\s  ]/g, '')
      .replace(',', '.')
      .replace(/[^0-9.\-]/g, '');
    var v = parseFloat(s);
    return isFinite(v) ? v : 0;
  }

  // ── Расчёт покупки ───────────────────────────────────────────────────────

  /**
   * Итого и цена за единицу для обоих режимов ввода (T-007, п. 14).
   * mode: 'unit' — введена цена за единицу; 'total' — введена сумма за всё.
   * Возвращает { qty, unitPrice, total, valid }. Суммы округляются до сума.
   */
  function computeLine(qty, price, mode) {
    var q = parseNum(qty);
    var p = parseNum(price);
    if (!(q > 0) || !(p > 0)) {
      return { qty: q, unitPrice: 0, total: 0, valid: false };
    }
    var unitPrice, total;
    if (mode === 'total') {
      total = Math.round(p);
      unitPrice = total / q;
    } else {
      unitPrice = p;
      total = Math.round(q * p);
    }
    return { qty: q, unitPrice: unitPrice, total: total, valid: true };
  }

  /** «5 кг × 12 000 сум» — строка расчёта под «Итого». */
  function unitLine(qty, unitPrice, unitId) {
    var u = unitById(unitId);
    return formatQty(qty) + ' ' + u.label + ' × ' + formatSum(Math.round(unitPrice)) + ' сум';
  }

  /**
   * Проверка «цена выше обычной» (T-007, п. 15).
   * avgPrice — обычная цена за единицу; 0/undefined — нормы нет, не сигналим.
   */
  function isPriceHigh(unitPrice, avgPrice, ratio) {
    var avg = Number(avgPrice) || 0;
    if (avg <= 0) return false;
    return Number(unitPrice) > avg * (ratio || PRICE_WARN_RATIO);
  }

  /**
   * Опыт за покупку с разбивкой — то, что показывается на шаге 4 и на «Записано!».
   * Возвращает { total, parts: [{ label, xp }] }.
   */
  function purchaseXp(opts) {
    var parts = [{ label: 'Покупка +' + XP.PURCHASE, xp: XP.PURCHASE }];
    if (opts && opts.hasPhoto) parts.push({ label: 'Фото +' + XP.PHOTO, xp: XP.PHOTO });
    else parts.push({ label: 'Без фото ' + XP.NO_PHOTO, xp: XP.NO_PHOTO });
    if (!(opts && opts.priceHigh)) parts.push({ label: 'Цена в норме +' + XP.FAIR_PRICE, xp: XP.FAIR_PRICE });
    var total = parts.reduce(function (s, p) { return s + p.xp; }, 0);
    return { total: total, parts: parts };
  }

  /** Бонус за закуп, уложившийся в лимит (T-007, пп. 9, 18). */
  function tripBonusXp(elapsedSec, limitSec) {
    var limit = limitSec == null ? TRIP_LIMIT_SEC : limitSec;
    return Number(elapsedSec) <= limit ? XP.TRIP_IN_TIME : 0;
  }

  /** Секунды → «мм:сс», с запасом на закупы длиннее часа. */
  function formatClock(sec) {
    var s = Math.max(0, Math.floor(Number(sec) || 0));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  // ── Уровни ───────────────────────────────────────────────────────────────

  /**
   * Уровень по накопленному опыту.
   * { lvl, title, xp, into, span, toNext, pct } — into/span для полоски прогресса.
   */
  function levelInfo(xp) {
    var x = Math.max(0, Math.round(Number(xp) || 0));
    var cur = LEVELS[0];
    var next = null;
    for (var i = 0; i < LEVELS.length; i++) {
      if (x >= LEVELS[i].min) { cur = LEVELS[i]; next = LEVELS[i + 1] || null; }
    }
    if (!next) {
      return { lvl: cur.lvl, title: cur.title, xp: x, into: 0, span: 0, toNext: 0, pct: 100, isMax: true };
    }
    var span = next.min - cur.min;
    var into = x - cur.min;
    return {
      lvl: cur.lvl,
      title: cur.title,
      xp: x,
      into: into,
      span: span,
      toNext: next.min - x,
      pct: Math.max(0, Math.min(100, Math.round((into / span) * 100))),
      isMax: false
    };
  }

  // ── Баланс ───────────────────────────────────────────────────────────────

  function sumBy(list, key) {
    return (list || []).reduce(function (s, r) { return s + (Number(r[key]) || 0); }, 0);
  }

  /**
   * Наличные на руках и процент отчётности.
   * issued — выдачи наличных бухгалтером, purchases — внесённые покупки.
   */
  function balance(issued, purchases) {
    var got = sumBy(issued, 'amount');
    var spent = sumBy(purchases, 'total');
    return {
      issued: got,
      spent: spent,
      onHand: got - spent,
      reportedPct: got > 0 ? Math.max(0, Math.min(100, Math.round((spent / got) * 100))) : 0
    };
  }

  // ── Даты, неделя, серия ──────────────────────────────────────────────────

  var WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  /** Локальная дата в виде «2026-09-28» — ключ дня, не UTC. */
  function dayKey(d) {
    var dt = d instanceof Date ? d : new Date(d);
    var m = dt.getMonth() + 1;
    var day = dt.getDate();
    return dt.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  /** «28 сентября, пн» — подзаголовок шапки. */
  function formatDate(d) {
    var dt = d instanceof Date ? d : new Date(d);
    return dt.getDate() + ' ' + MONTHS[dt.getMonth()] + ', ' + WEEKDAYS[dt.getDay()].toLowerCase();
  }

  function shiftDay(d, delta) {
    var dt = new Date(d instanceof Date ? d.getTime() : new Date(d).getTime());
    dt.setDate(dt.getDate() + delta);
    return dt;
  }

  /** Семь дней по сегодняшний включительно, с отметкой активности. */
  function weekStrip(purchases, today) {
    var days = {};
    (purchases || []).forEach(function (p) { days[dayKey(p.at)] = true; });
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var d = shiftDay(today, -i);
      var k = dayKey(d);
      out.push({ key: k, label: WEEKDAYS[d.getDay()], active: !!days[k], isToday: i === 0 });
    }
    return out;
  }

  /**
   * Серия дней без пропусков. Сегодня без покупок серию ещё не рвёт —
   * день не закончился, поэтому отсчёт начинается со вчера.
   */
  function streakDays(purchases, today) {
    var days = {};
    (purchases || []).forEach(function (p) { days[dayKey(p.at)] = true; });
    var n = 0;
    var start = days[dayKey(today)] ? 0 : 1;
    for (var i = start; i < 400; i++) {
      if (!days[dayKey(shiftDay(today, -i))]) break;
      n++;
    }
    return n;
  }

  /** «5 дней» / «1 день» / «21 день» — русское склонение. */
  function pluralDays(n) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return n + ' дней';
    if (b === 1) return n + ' день';
    if (b >= 2 && b <= 4) return n + ' дня';
    return n + ' дней';
  }

  // ── Задания на сегодня ───────────────────────────────────────────────────

  /**
   * Три квеста из прототипа, посчитанные от сегодняшней активности.
   * purchases — все покупки, trips — завершённые закупы.
   */
  function todayQuests(purchases, trips, today) {
    var k = dayKey(today);
    var mine = (purchases || []).filter(function (p) { return dayKey(p.at) === k; });
    var withPhoto = mine.filter(function (p) { return !!p.hasPhoto; });
    var inTime = (trips || []).filter(function (t) {
      return t.finishedAt && dayKey(t.finishedAt) === k && t.elapsedSec <= TRIP_LIMIT_SEC;
    });
    function q(id, title, have, need) {
      return {
        id: id, title: title,
        have: Math.min(have, need), need: need,
        done: have >= need,
        sub: Math.min(have, need) + ' из ' + need,
        pct: Math.max(0, Math.min(100, Math.round((have / need) * 100))),
        xp: XP.QUEST
      };
    }
    return [
      q('three', 'Внести три покупки', mine.length, 3),
      q('photos', 'Фото к каждой покупке', withPhoto.length, 3),
      q('fast', 'Закуп за 15 минут', inTime.length, 1)
    ];
  }

  return {
    XP: XP,
    TRIP_LIMIT_SEC: TRIP_LIMIT_SEC,
    PRICE_WARN_RATIO: PRICE_WARN_RATIO,
    LEVELS: LEVELS,
    UNITS: UNITS,
    unitById: unitById,
    formatSum: formatSum,
    formatQty: formatQty,
    parseNum: parseNum,
    computeLine: computeLine,
    unitLine: unitLine,
    isPriceHigh: isPriceHigh,
    purchaseXp: purchaseXp,
    tripBonusXp: tripBonusXp,
    formatClock: formatClock,
    levelInfo: levelInfo,
    balance: balance,
    dayKey: dayKey,
    formatDate: formatDate,
    shiftDay: shiftDay,
    weekStrip: weekStrip,
    streakDays: streakDays,
    pluralDays: pluralDays,
    todayQuests: todayQuests
  };
});
