/**
 * PROMPT MODULE 6: MEMORY ENGINE (UPGRADED)
 * Enterprise-grade multi-tiered memory engine.
 * Structuring memory into: shortTerm, working, longTerm, CRM facts, extracted entities, goals, and pendingTasks.
 */

class MemoryEngine {
  constructor(initialData = {}) {
    this.memory = {
      shortTerm: {
        lastUserUtterance: '',
        lastAssistantResponse: '',
        turnCount: initialData.turnCount || 0
      },
      working: {
        currentFsmStage: initialData.stage || 'greeting',
        activeObjections: [],
        buyingSignals: []
      },
      longTerm: {
        previousCallSummaries: initialData.previousCallSummaries || []
      },
      crm: {
        ownerName: initialData.ownerName || '',
        businessName: initialData.businessName || '',
        industry: initialData.industry || 'general business',
        targetPhoneNumber: initialData.targetPhoneNumber || ''
      },
      entities: {
        name: initialData.clientName || '',
        budget: initialData.budget || '',
        email: initialData.clientEmail || '',
        website: initialData.website || '',
        employees: initialData.employees || '',
        competitor: initialData.competitor || '',
        crmSystem: initialData.crmSystem || '',
        city: initialData.city || '',
        state: initialData.state || ''
      },
      goals: {
        primary: 'Book dynamic Google Calendar slot or send instant SMS demo link',
        current: 'Identify business decision maker and pain points',
        status: 'in-progress'
      },
      pendingTasks: []
    };
  }

  updateEntities(detectedEntities = {}) {
    for (const [key, val] of Object.entries(detectedEntities)) {
      if (val && key in this.memory.entities) {
        this.memory.entities[key] = val;
      }
    }
  }

  getMemoryContext() {
    const ent = this.memory.entities;
    return `=== 6. CONVERSATION MEMORY & EXTRACTED ENTITIES ===
- Client Name: ${ent.name || 'Unknown'}
- Business Name: ${this.memory.crm.businessName || 'Unknown'}
- Email: ${ent.email || 'Not collected'}
- Budget: ${ent.budget || 'Not discussed'}
- Website: ${ent.website || 'Not collected'}
- Location: ${ent.city ? `${ent.city}, ${ent.state}` : 'Not collected'}
- Competitor: ${ent.competitor || 'None mentioned'}
- Current Goal: ${this.memory.goals.current}
- Working Stage: ${this.memory.working.currentFsmStage}`;
  }
}

module.exports = {
  MemoryEngine
};
