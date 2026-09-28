/* Справочники: точки закупа и номенклатура товаров.
 *
 * ВНИМАНИЕ: содержимое ДЕМОНСТРАЦИОННОЕ (T-007 → «Зависимости»: реальный список
 * точек и товаров ещё не передан). Когда список придёт — меняется только этот
 * файл, логика приложения его не знает.
 *
 * avg — обычная цена за единицу в сумах. На неё опирается проверка
 * «цена выше обычной» (core.isPriceHigh). Порог — core.PRICE_WARN_RATIO.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RVData = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  var POINTS = [
    { id: 'chorsu', mono: 'ЧР', name: 'Чорсу', sub: 'Овощи, зелень, мясо' },
    { id: 'farhad', mono: 'ФР', name: 'Фархадский', sub: 'Бакалея, крупы' },
    { id: 'korzinka', mono: 'КР', name: 'Korzinka', sub: 'Супермаркет, чек' },
    { id: 'oltin', mono: 'ОЛ', name: 'Олтин водий', sub: 'Молочка, яйцо' }
  ];

  var CATEGORIES = [
    { id: 'veg', label: 'Овощи' },
    { id: 'meat', label: 'Мясо' },
    { id: 'grocery', label: 'Бакалея' },
    { id: 'dairy', label: 'Молочка' }
  ];

  var ITEMS = [
    { id: 'tomato', cat: 'veg', name: 'Помидоры', unit: 'kg', avg: 14000 },
    { id: 'cucumber', cat: 'veg', name: 'Огурцы', unit: 'kg', avg: 12000 },
    { id: 'onion', cat: 'veg', name: 'Лук', unit: 'kg', avg: 5000 },
    { id: 'potato', cat: 'veg', name: 'Картошка', unit: 'kg', avg: 6500 },
    { id: 'carrot', cat: 'veg', name: 'Морковь', unit: 'kg', avg: 7000 },
    { id: 'greens', cat: 'veg', name: 'Зелень', unit: 'pack', avg: 4000 },

    { id: 'beef', cat: 'meat', name: 'Говядина', unit: 'kg', avg: 95000 },
    { id: 'lamb', cat: 'meat', name: 'Баранина', unit: 'kg', avg: 110000 },
    { id: 'chicken', cat: 'meat', name: 'Курица', unit: 'kg', avg: 42000 },

    { id: 'rice', cat: 'grocery', name: 'Рис', unit: 'kg', avg: 18000 },
    { id: 'flour', cat: 'grocery', name: 'Мука', unit: 'kg', avg: 8000 },
    { id: 'oil', cat: 'grocery', name: 'Масло подсолн.', unit: 'l', avg: 22000 },
    { id: 'sugar', cat: 'grocery', name: 'Сахар', unit: 'kg', avg: 13000 },
    { id: 'pasta', cat: 'grocery', name: 'Макароны', unit: 'pack', avg: 11000 },

    { id: 'milk', cat: 'dairy', name: 'Молоко', unit: 'l', avg: 12000 },
    { id: 'eggs', cat: 'dairy', name: 'Яйцо', unit: 'pc', avg: 1400 },
    { id: 'butter', cat: 'dairy', name: 'Сливочное масло', unit: 'kg', avg: 95000 },
    { id: 'cheese', cat: 'dairy', name: 'Сыр', unit: 'kg', avg: 88000 }
  ];

  /** Начальное состояние дня: выдача наличных и перечисления от бухгалтера. */
  function seed(now) {
    var today = now || new Date();
    return {
      issued: [
        {
          id: 'iss-demo-1',
          at: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 30).toISOString(),
          amount: 5000000,
          note: 'Выдано на закуп'
        }
      ],
      // Read-only: перечисления вносит только бухгалтер (T-007, п. 6).
      transfers: [
        { id: 'tr-demo-1', title: 'Мясо — ИП Каримов', sub: 'Оплачено переводом 08:10 · 1 200 000 сум', amount: 1200000 },
        { id: 'tr-demo-2', title: 'Вода — Nestle', sub: 'Оплачено переводом вчера · 340 000 сум', amount: 340000 }
      ]
    };
  }

  function pointById(id) {
    for (var i = 0; i < POINTS.length; i++) if (POINTS[i].id === id) return POINTS[i];
    return null;
  }

  function itemById(id) {
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i];
    return null;
  }

  return {
    POINTS: POINTS,
    CATEGORIES: CATEGORIES,
    ITEMS: ITEMS,
    seed: seed,
    pointById: pointById,
    itemById: itemById
  };
});
