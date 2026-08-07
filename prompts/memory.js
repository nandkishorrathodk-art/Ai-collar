/**
 * PROMPT MODULE 6: MEMORY ENGINE
 * Maintains state & caller facts across multi-turn voice conversations.
 */

class MemoryEngine {
  constructor(initialData = {}) {
    this.memory = {
      clientName: initialData.clientName || 'Prospect',
      businessName: initialData.businessName || '',
      industry: initialData.industry || 'general business',
      targetPhoneNumber: initialData.targetPhoneNumber || '',
      painPoints: initialData.painPoints || [],
      budget: initialData.budget || null,
      previousCallsCount: initialData.previousCallsCount || 0,
      currentGoal: initialData.currentGoal || 'schedule_demo',
      appointmentTime: initialData.appointmentTime || null,
      notes: initialData.notes || []
    };
  }

  updateMemory(key, value) {
    if (Array.isArray(this.memory[key])) {
      this.memory[key].push(value);
    } else {
      this.memory[key] = value;
    }
  }

  getMemoryContext() {
    return `=== 6. CALLER MEMORY ===
Client Name: ${this.memory.clientName}
Business: ${this.memory.businessName || 'Not specified'}
Industry: ${this.memory.industry}
Phone: ${this.memory.targetPhoneNumber}
Current Goal: ${this.memory.currentGoal}
Appointment Booked: ${this.memory.appointmentTime ? this.memory.appointmentTime : 'None yet'}`;
  }
}

module.exports = {
  MemoryEngine
};
