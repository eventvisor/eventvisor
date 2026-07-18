/** @type {import('@eventvisor/core').ProjectConfig} */
module.exports = {
  sets: true,
  tags: ["all", "checkout"],
  prettyDatafile: true,
  promotionFlows: [
    { from: "development", to: "staging" },
    { from: "staging", to: "production" },
  ],
};
