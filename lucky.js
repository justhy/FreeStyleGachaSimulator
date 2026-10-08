/**
 * 抽奖核心：加权随机抽取 + 批量模拟统计
 *
 * 不依赖任何第三方库，纯 Node.js。
 */

const { POOL_SINGLE, POOL_MULTI, QUALITY_ORDER } = require('./prizes');

/** 可选：用可复现的随机源（默认 Math.random） */
function makeRandom(seed) {
  if (seed === undefined || seed === null) return Math.random;
  // xorshift32，保证同 seed 结果可复现，便于测试
  let s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * 构建抽奖器
 * @param {Array} pool 奖池；weight 会自动归一化
 * @param {Function} rand 随机源
 */
function createDrawer(pool, rand = Math.random) {
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) throw new Error('奖池权重合计必须大于 0');

  // 构建前缀和，把「按权重随机」变成一次 O(log n) 二分查找
  const cumulative = [];
  let acc = 0;
  for (const item of pool) {
    acc += item.weight;
    cumulative.push(acc);
  }

  /** 抽一次，返回 { quality, name, amount, weight } */
  function drawOne() {
    const r = rand() * total;
    // 二分查找第一个累计值 > r 的位置
    let lo = 0, hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] > r) hi = mid;
      else lo = mid + 1;
    }
    const item = pool[lo];
    return { quality: item.quality, name: item.name, amount: item.amount, weight: item.weight };
  }

  /** 抽 n 次，返回结果数组 */
  function draw(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(drawOne());
    return out;
  }

  return { drawOne, draw, total, pool };
}

function drawerForTimes(times, rand) {
  return times === 1 ? createDrawer(POOL_SINGLE, rand) : createDrawer(POOL_MULTI, rand);
}

/** 按「品质 + 道具名 + 数量」聚合统计 */
function summarize(results) {
  const map = new Map();
  for (const r of results) {
    const key = `${r.quality}|${r.name}|${r.amount}`;
    if (!map.has(key)) map.set(key, { ...r, count: 0 });
    map.get(key).count++;
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** 按品质汇总 */
function qualityStats(results) {
  const map = new Map();
  for (const r of results) map.set(r.quality, (map.get(r.quality) || 0) + 1);
  const total = results.length;
  return QUALITY_ORDER
    .filter(q => map.has(q))
    .map(q => ({ quality: q, count: map.get(q), rate: map.get(q) / total }));
}

/**
 * 只统计「稀有物品」命中情况（传说 / 唯一），用于概率校验
 */
function rareStats(results) {
  const rare = results.filter(r => r.quality === '传说' || r.quality === '唯一');
  const byQuality = {};
  for (const q of ['传说', '唯一']) {
    byQuality[q] = rare.filter(r => r.quality === q).length;
  }
  return { count: rare.length, rate: rare.length / results.length, byQuality };
}

module.exports = {
  makeRandom, createDrawer, drawerForTimes,
  summarize, qualityStats, rareStats, QUALITY_ORDER,
};
