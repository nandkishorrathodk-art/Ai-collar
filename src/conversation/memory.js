const MEMORY_LAYERS = {
  shortMemory: {},
  workingMemory: {},
  leadCrmMemory: {},
  businessMemory: {},
  knowledgeMemory: {}
};

function composeMemoryLayers(base = {}) {
  return {
    ...MEMORY_LAYERS,
    ...base,
    shortMemory: { ...(base.shortMemory || {}) },
    workingMemory: { ...(base.workingMemory || {}) },
    leadCrmMemory: { ...(base.leadCrmMemory || {}) },
    businessMemory: { ...(base.businessMemory || {}) },
    knowledgeMemory: { ...(base.knowledgeMemory || {}) }
  };
}

module.exports = {
  MEMORY_LAYERS,
  composeMemoryLayers
};
