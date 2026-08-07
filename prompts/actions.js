/**
 * PROMPT MODULE 11: ACTION TRIGGERS
 * Manages action trigger tags recognized by hybrid-voice action parser.
 */

const ACTION_TAGS = {
  SEND_DEMO_SMS: '[ACTION:SEND_DEMO_SMS]',
  BOOK_APPOINTMENT: '[ACTION:BOOK_APPOINTMENT]',
  SEND_INVOICE: '[ACTION:SEND_INVOICE]',
  TRANSFER_CALL: '[ACTION:TRANSFER_CALL]',
  MARK_DNC: '[ACTION:MARK_DNC]'
};

function getActionsContext() {
  return `=== 11. ACTION TRIGGER TAGS ===
When executing an action, include the corresponding tag at the end of your reply:
- Send SMS Demo: ${ACTION_TAGS.SEND_DEMO_SMS}
- Book Calendar Appointment: ${ACTION_TAGS.BOOK_APPOINTMENT}
- Send Checkout Invoice: ${ACTION_TAGS.SEND_INVOICE}
- Do Not Call Request: ${ACTION_TAGS.MARK_DNC}`;
}

module.exports = {
  ACTION_TAGS,
  getActionsContext
};
