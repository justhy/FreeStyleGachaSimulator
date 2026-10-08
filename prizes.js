/**
 * 抽奖配置：物品 + 品质 + 权重/概率
 *
 * 说明：表中「抽取10次/50次」一档的数值是该档的池内权重（归一化后即概率），
 * 与「抽取1次」是两套独立的池子，各自合计 100%。
 *
 * 概率单位统一用「权重」，可以是百分比（合计100）也可以是整数权重（合计任意）。
 * 程序内部会自动归一化，不必手动保证合计为 1。
 */

// 抽取 1 次的池子
const POOL_SINGLE = [
  { quality: '传说', name: '莱克丝角色包',         amount: '1个',    weight: 0.10 },
  { quality: '传说', name: '莱克丝变更卡',         amount: '1个',    weight: 0.05 },
  { quality: '传说', name: '徽记卡转移券',       amount: '1个',    weight: 0.05 },
  { quality: '传说', name: '超特强化碎片兑换券', amount: '1个',    weight: 0.05 },

  { quality: '唯一', name: '虚拟浪潮队伍徽记卡', amount: '5个',    weight: 0.70 },
  { quality: '唯一', name: 'VVIP',               amount: '30天',   weight: 0.60 },
  { quality: '唯一', name: '超级能力加强包',     amount: '30天',   weight: 0.70 },
  { quality: '唯一', name: '新更改组合装外形',   amount: '14天',   weight: 0.70 },

  { quality: '高级', name: '虚拟浪潮队伍徽记卡', amount: '1个',    weight: 1.50 },
  { quality: '高级', name: '高级徽记卡',         amount: '1个',    weight: 2.00 },
  { quality: '高级', name: '完整的强化碎片箱钥匙', amount: '10个', weight: 2.50 },
  { quality: '高级', name: '完整的创建碎片箱钥匙', amount: '10个', weight: 2.50 },
  { quality: '高级', name: '完整的道具碎片箱钥匙', amount: '10个', weight: 1.50 },
  { quality: '高级', name: '笑脸',               amount: '50个',   weight: 3.50 },

  { quality: '普通', name: '黄金徽记卡',         amount: '2个',    weight: 11.00 },
  { quality: '普通', name: '完整的普通碎片箱钥匙', amount: '10个', weight: 12.00 },
  { quality: '普通', name: '红色龙珠',           amount: '4个',    weight: 13.00 },
  { quality: '普通', name: '笑脸',               amount: '25个',   weight: 14.00 },
  { quality: '普通', name: '蓝色龙珠',           amount: '4个',    weight: 16.00 },
  { quality: '普通', name: '积分',               amount: '10000',  weight: 17.55 },
];

// 抽取 10 次 / 50 次的池子
const POOL_MULTI = [
  { quality: '传说', name: '莱克丝角色包',         amount: '1个',    weight: 0.20 },
  { quality: '传说', name: '莱克丝变更卡',         amount: '1个',    weight: 0.10 },
  { quality: '传说', name: '徽记卡转移券',       amount: '1个',    weight: 0.10 },
  { quality: '传说', name: '超特强化碎片兑换券', amount: '1个',    weight: 0.10 },

  { quality: '唯一', name: '虚拟浪潮队伍徽记卡', amount: '5个',    weight: 0.60 },
  { quality: '唯一', name: 'VVIP',               amount: '30天',   weight: 0.60 },
  { quality: '唯一', name: '超级能力加强包',     amount: '30天',   weight: 0.60 },
  { quality: '唯一', name: '新更改组合装外形',   amount: '14天',   weight: 0.80 },

  { quality: '高级', name: '虚拟浪潮队伍徽记卡', amount: '1个',    weight: 1.50 },
  { quality: '高级', name: '高级徽记卡',         amount: '1个',    weight: 2.00 },
  { quality: '高级', name: '完整的强化碎片箱钥匙', amount: '10个', weight: 2.50 },
  { quality: '高级', name: '完整的创建碎片箱钥匙', amount: '10个', weight: 2.50 },
  { quality: '高级', name: '完整的道具碎片箱钥匙', amount: '10个', weight: 1.50 },
  { quality: '高级', name: '笑脸',               amount: '50个',   weight: 3.50 },

  { quality: '普通', name: '黄金徽记卡',         amount: '2个',    weight: 11.00 },
  { quality: '普通', name: '完整的普通碎片箱钥匙', amount: '10个', weight: 12.00 },
  { quality: '普通', name: '红色龙珠',           amount: '4个',    weight: 13.00 },
  { quality: '普通', name: '笑脸',               amount: '25个',   weight: 14.00 },
  { quality: '普通', name: '蓝色龙珠',           amount: '4个',    weight: 16.00 },
  { quality: '普通', name: '积分',               amount: '10000',  weight: 17.40 },
];

const QUALITY_ORDER = ['传说', '唯一', '高级', '普通'];

module.exports = { POOL_SINGLE, POOL_MULTI, QUALITY_ORDER };
