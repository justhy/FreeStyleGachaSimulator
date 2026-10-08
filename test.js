/**
 * 自检：概率表合法性 + 加权随机正确性 + 页面完整性 + 各活动数据
 *
 * 运行: node test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { POOL_SINGLE, POOL_MULTI } = require('./prizes');
const { createDrawer, makeRandom, qualityStats } = require('./lucky');

let passed = 0, failed = 0;
function ok(name) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
function bad(name, err) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}\n      ${err}`); }
function check(name, fn) {
  try { fn(); ok(name); } catch (e) { bad(name, e.message); }
}
const eq = (a, b, msg) => assert.strictEqual(a, b, `${msg}（实际 ${JSON.stringify(a)}）`);

console.log('\n概率表校验');

for (const [label, pool] of [['抽取1次', POOL_SINGLE], ['抽取10次/50次', POOL_MULTI]]) {
  const total = pool.reduce((s, x) => s + x.weight, 0);
  const diff = Math.abs(total - 100);
  assert.ok(diff < 1e-9, `${label} 权重合计应为 100，实际 ${total}`);
  ok(`${label} 权重合计 = ${total.toFixed(2)}%`);

  for (const item of pool) {
    assert.ok(item.weight > 0, `${label} 存在非正权重: ${item.name}`);
    assert.ok(item.name && item.quality && item.amount, `${label} 字段缺失`);
  }
  ok(`${label} ${pool.length} 项，字段与权重均合法`);
}

// 两档池子对比：10次档的传说/唯一概率更高
const sumRare = (pool, qualities) =>
  pool.filter(p => qualities.includes(p.quality)).reduce((s, p) => s + p.weight, 0);
const rareSingle = sumRare(POOL_SINGLE, ['传说', '唯一']);
const rareMulti = sumRare(POOL_MULTI, ['传说', '唯一']);
assert.ok(rareMulti > rareSingle, '10次/50次档的稀有概率应高于单抽档');
ok(`稀有概率 单抽 ${rareSingle.toFixed(2)}% < 多抽 ${rareMulti.toFixed(2)}%`);

console.log('\n随机算法校验');

// 1. 边界：固定随机源返回 0，应命中第一个；返回接近 1，应命中最后一个
{
  const d0 = createDrawer(POOL_SINGLE, () => 0);
  assert.strictEqual(d0.drawOne().name, POOL_SINGLE[0].name);
  const d1 = createDrawer(POOL_SINGLE, () => 0.9999999999);
  assert.strictEqual(d1.drawOne().name, POOL_SINGLE[POOL_SINGLE.length - 1].name);
  ok('随机数边界（0 / ≈1）命中首尾项');
}

// 2. 卡方检验：模拟 200 万次，检验实际分布是否符合设定权重
{
  const N = 2_000_000;
  const drawer = createDrawer(POOL_SINGLE, makeRandom(20260921));
  const counts = new Map();
  for (let i = 0; i < N; i++) {
    const r = drawer.drawOne();
    const key = `${r.quality}|${r.name}|${r.amount}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const totalW = POOL_SINGLE.reduce((s, x) => s + x.weight, 0);
  let chi2 = 0;
  let maxDev = 0;
  let maxDevItem = '';
  for (const item of POOL_SINGLE) {
    const key = `${item.quality}|${item.name}|${item.amount}`;
    const expected = (item.weight / totalW) * N;
    const actual = counts.get(key) || 0;
    chi2 += (actual - expected) ** 2 / expected;
    const relDev = Math.abs(actual - expected) / expected;
    if (relDev > maxDev) { maxDev = relDev; maxDevItem = `${item.name}`; }
  }
  // df = 19，χ² 临界值(α=0.001) ≈ 52.0，远超则说明分布不对
  assert.ok(chi2 < 52.0, `卡方值 ${chi2.toFixed(2)} 过大，分布不符合预期`);
  ok(`卡方检验通过 (N=${N.toLocaleString()}, χ²=${chi2.toFixed(2)}, df=19, 临界值52.0)`);
  ok(`最大相对偏差 ${(maxDev * 100).toFixed(2)}% (${maxDevItem})，抽样误差范围内`);

  const qs = qualityStats(Array.from({ length: 1 }, () => POOL_SINGLE[0]));
  assert.ok(qs.length > 0);
  ok('品质汇总函数可用');
}

// 3. 种子可复现
{
  const a = createDrawer(POOL_SINGLE, makeRandom(42)).draw(50).map(r => r.name).join(',');
  const b = createDrawer(POOL_SINGLE, makeRandom(42)).draw(50).map(r => r.name).join(',');
  assert.strictEqual(a, b);
  ok('相同种子结果可复现');
}

/* ============================================================
 * 页面完整性
 * ============================================================ */
console.log('\n页面完整性校验');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

check('index.html 内联脚本语法正确', () => {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0, '未找到内联脚本');
  for (const s of scripts) new vm.Script(s[1]);
});

check('页面内置概率表与 prizes.js 一致', () => {
  // 从 index.html 里把两个数组字面量抠出来（避免为了单文件可用而重复的数据悄悄漂移）
  const grabArray = name => {
    const at = html.indexOf(`const ${name} = [`);
    assert.ok(at >= 0, `index.html 未找到 ${name}`);
    const start = html.indexOf('[', at);
    let depth = 0, end = start;
    for (; end < html.length; end++) {
      if (html[end] === '[') depth++;
      else if (html[end] === ']') { depth--; if (depth === 0) break; }
    }
    return eval('(' + html.slice(start, end + 1) + ')'); // eslint-disable-line no-eval
  };

  for (const [name, ref] of [['POOL_SINGLE', POOL_SINGLE], ['POOL_MULTI', POOL_MULTI]]) {
    const arr = grabArray(name);
    eq(arr.length, ref.length, `${name} 条目数`);
    for (let i = 0; i < ref.length; i++) {
      eq(arr[i].quality, ref[i].quality, `${name}[${i}] 品质`);
      eq(arr[i].name, ref[i].name, `${name}[${i}] 物品名`);
      eq(arr[i].amount, ref[i].amount, `${name}[${i}] 数量`);
      eq(arr[i].weight, ref[i].weight, `${name}[${i}] 权重`);
    }
  }
});

/* ============================================================
 * 徽记卡校验
 * ============================================================ */
console.log('\n徽记卡校验');

// 从 index.html 抠出徽记卡数据表（与页面共用同一份，避免漂移）
const grabObject = name => {
  const at = html.indexOf(`const ${name} = `);
  assert.ok(at >= 0, `index.html 未找到 ${name}`);
  const start = html.indexOf('{', at);
  let depth = 0, end = start;
  for (; end < html.length; end++) {
    if (html[end] === '{') depth++;
    else if (html[end] === '}') { depth--; if (depth === 0) break; }
  }
  return eval('(' + html.slice(start, end + 1) + ')'); // eslint-disable-line no-eval
};

const HJK_GRADE_PROB = grabObject('HJK_GRADE_PROB');
const HJK_SYNTH = grabObject('HJK_SYNTH');
const HJK_PACK = grabObject('HJK_PACK');
const HJK_EFFECTS = grabObject('HJK_EFFECTS');

check('徽记卡 7 个星级的等级概率合计均为 100%', () => {
  for (const s of Object.keys(HJK_GRADE_PROB)) {
    const sum = HJK_GRADE_PROB[s].reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `${s}星 等级概率合计 ${sum}`);
  }
});

check('徽记卡合成 升+维持+降 = 100%', () => {
  for (const s of Object.keys(HJK_SYNTH)) {
    for (const cur of ['point', 'coupon']) {
      const c = HJK_SYNTH[s][cur];
      const sum = c.up + c.keep + c.down;
      assert.ok(Math.abs(sum - 1) < 1e-9, `${s}星 ${cur} 合计 ${sum}`);
      assert.ok(c.cost > 0, `${s}星 ${cur} 消耗应为正`);
    }
  }
});

check('徽记卡包星级概率合计为 100%', () => {
  const p = HJK_PACK.starProb;
  assert.ok(Math.abs(p[1] + p[2] + p[3] - 1) < 1e-9, `合计 ${p[1] + p[2] + p[3]}`);
});

check('徽记卡四色效果池均非空', () => {
  for (const k of ['red', 'yellow', 'green', 'blue']) {
    assert.ok(Array.isArray(HJK_EFFECTS[k]) && HJK_EFFECTS[k].length > 0, `${k} 效果池为空`);
  }
});

/* ============================================================
 * 能力随机卡校验
 * ============================================================ */
console.log('\n能力随机卡校验');

const ABILITY = grabObject('ABILITY');

check('能力随机卡 概率合计为 100%', () => {
  const sum = ABILITY.probs.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `合计 ${sum}`);
});

check('能力随机卡 单项概率递减且为正', () => {
  for (let i = 0; i < ABILITY.probs.length; i++) {
    assert.ok(ABILITY.probs[i] > 0, `第 ${i + 1} 项应为正`);
    if (i) assert.ok(ABILITY.probs[i] < ABILITY.probs[i - 1], `第 ${i + 1} 项应小于前一项`);
  }
});

check('能力随机卡 单价为正', () => {
  assert.ok(ABILITY.price > 0, `price=${ABILITY.price}`);
});

check('能力随机卡 每个能力值都有积分加成', () => {
  for (let v = 1; v <= ABILITY.probs.length; v++) {
    assert.ok(typeof ABILITY.bonus[v] === 'number' && ABILITY.bonus[v] > 0, `能力+${v} 缺少积分加成`);
  }
});

/* ============================================================
 * 周宝箱校验
 * ============================================================ */
console.log('\n周宝箱校验');

const WEEKBOX = grabObject('WEEKBOX');

check('周宝箱 各等级随机品质概率合计为 100%', () => {
  for (const lv of Object.keys(WEEKBOX.quality)) {
    const sum = WEEKBOX.quality[lv].rand.reduce((a, r) => a + r.p, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `${lv} 合计 ${sum}`);
  }
});

check('周宝箱 各品质掉落概率合计为 100%', () => {
  for (const q of Object.keys(WEEKBOX.drops)) {
    const sum = WEEKBOX.drops[q].reduce((a, d) => a + d.p, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `${q} 合计 ${sum}`);
  }
});

check('周宝箱 随机奖励数量表完整（5 等级 × 5 细分）', () => {
  for (const lv of ['青铜', '白银', '黄金', '铂金', '钻石']) {
    for (const s of ['V', 'IV', 'III', 'II', 'I']) {
      assert.ok(WEEKBOX.count[lv] && WEEKBOX.count[lv][s] > 0, `${lv} ${s} 缺失`);
    }
  }
});

check('周宝箱 确保品质在掉落表中存在', () => {
  for (const lv of Object.keys(WEEKBOX.quality)) {
    const sure = WEEKBOX.quality[lv].sure;
    assert.ok(WEEKBOX.drops[sure], `${lv} 确保品质 ${sure} 无掉落表`);
    for (const r of WEEKBOX.quality[lv].rand) {
      assert.ok(WEEKBOX.drops[r.q], `${lv} 随机品质 ${r.q} 无掉落表`);
    }
  }
});

/* ============================================================
 * 道具图标校验
 * ============================================================ */
console.log('\n道具图标校验');

const ITEM_ICONS = grabObject('ITEM_ICONS');

check('道具图标映射覆盖所有奖池与宝箱物品', () => {
  const RENAME = { '莱克丝角色包': '杰德角色包', '莱克丝变更卡': '杰德变更卡' };
  const names = new Set();
  for (const p of [...POOL_SINGLE, ...POOL_MULTI]) {
    names.add(p.name);
    if (RENAME[p.name]) names.add(RENAME[p.name]);   // 华丽DJ杰德派生的同名项
  }
  for (const q of Object.keys(WEEKBOX.drops)) {
    for (const d of WEEKBOX.drops[q]) names.add(d.name);
  }
  const missing = [...names].filter(n => !ITEM_ICONS[n]);
  assert.ok(missing.length === 0, `缺少图标映射: ${missing.join('、')}`);
});

check('道具图标文件都存在（img/）', () => {
  const files = [...new Set(Object.values(ITEM_ICONS))];
  const missing = files.filter(f => !fs.existsSync(path.join(__dirname, 'img', f)));
  assert.ok(missing.length === 0, `img/ 下缺少: ${missing.join('、')}`);
});

/* ============================================================
 * 闪耀DJ莱克丝 抽奖花费
 * ============================================================ */
console.log('\n闪耀DJ莱克丝 花费校验');

check('单抽花费为正（DRAW_COST）', () => {
  const m = html.match(/const DRAW_COST = (\d+)/);
  assert.ok(m, 'index.html 未找到 DRAW_COST');
  assert.ok(Number(m[1]) > 0, `DRAW_COST=${m[1]} 应为正数`);
});

check('积分购买档位（3 档，点券兑换）', () => {
  const m = html.match(/const POINT_PACKS = \[([\s\S]*?)\n\];/);
  assert.ok(m, 'index.html 未找到 POINT_PACKS');
  const packs = eval('[' + m[1] + ']');
  assert.strictEqual(packs.length, 3, `档位数量 ${packs.length}，应为 3`);
  for (const p of packs) {
    assert.ok(p.point > 0 && p.coupon > 0, `档位数值应为正：${JSON.stringify(p)}`);
  }
  for (let i = 1; i < packs.length; i++) {
    const prev = packs[i - 1].coupon / packs[i - 1].point;
    const cur = packs[i].coupon / packs[i].point;
    assert.ok(cur <= prev + 1e-12, `第 ${i + 1} 档单价（${cur}）高于上一档（${prev}）`);
  }
  assert.deepStrictEqual(
    packs.map(p => [p.point, p.coupon]),
    [[10000, 350], [50000, 1680], [100000, 3360]],
    '档位与参考图不符'
  );
});

check('积分不能用钱充值（CURRENCIES.point 无 rate）', () => {
  const m = html.match(/point:\s*\{([^}]*)\}/);
  assert.ok(m, 'index.html 未找到 CURRENCIES.point');
  assert.ok(!/rate/.test(m[1]), `积分仍带充值比例：${m[1].trim()}`);
});

check('活动列表只含已实现的 5 个活动', () => {
  const m = html.match(/const ACTIVITIES = \[([^\]]*)\]/);
  assert.ok(m, 'index.html 未找到 ACTIVITIES');
  const acts = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  const expect = ['徽记卡', '能力随机卡', '周宝箱', '闪耀DJ莱克丝', '华丽DJ杰德'];
  assert.deepStrictEqual(acts.slice().sort(), expect.slice().sort(), `ACTIVITIES = ${acts.join('、')}`);
  const p = html.match(/const POOL_ACTS = \[([^\]]*)\]/);
  assert.ok(p && p[1].includes('闪耀DJ莱克丝') && p[1].includes('华丽DJ杰德'), 'POOL_ACTS 未含两个概率池活动');
});

check('华丽DJ杰德 池子 = 莱克丝池改名（只差传说两件，合计仍 100%）', () => {
  const m = html.match(/const JED_RENAME = \{([^}]*)\}/);
  assert.ok(m, 'index.html 未找到 JED_RENAME');
  const RENAME = Object.fromEntries([...m[1].matchAll(/'([^']+)':\s*'([^']+)'/g)].map(x => [x[1], x[2]]));
  assert.ok(RENAME['莱克丝角色包'] === '杰德角色包' && RENAME['莱克丝变更卡'] === '杰德变更卡', JSON.stringify(RENAME));
  for (const [label, pool] of [['单抽', POOL_SINGLE], ['10抽/50抽', POOL_MULTI]]) {
    const jed = pool.map(it => RENAME[it.name] ? { ...it, name: RENAME[it.name] } : it);
    const total = jed.reduce((s, x) => s + x.weight, 0);
    assert.ok(Math.abs(total - 100) < 1e-9, `${label} 杰德池合计 ${total}`);
    const diff = jed.filter((it, i) => it.name !== pool[i].name).map(it => it.name);
    assert.deepStrictEqual(diff, ['杰德角色包', '杰德变更卡'], `${label} 差异项 ${diff.join('、')}`);
  }
});

console.log(
  failed
    ? `\n\x1b[31m失败 ${failed} 项\x1b[0m，通过 ${passed} 项\n`
    : `\n\x1b[32m全部通过\x1b[0m (${passed} 项)\n`
);
process.exit(failed ? 1 : 0);