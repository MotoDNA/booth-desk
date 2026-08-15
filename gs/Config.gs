/**
 * BOOTH DESK B2B — configuration.
 *
 * Nothing secret lives in this file. Keys are read from Script Properties,
 * which stay inside the customer's own Apps Script project:
 *   File > Project settings > Script properties
 *
 *   ANTHROPIC_API_KEY   required for the AI actions
 *   SHARED_TOKEN        required; the app sends it on every request
 *   SPREADSHEET_ID      optional; defaults to the bound spreadsheet
 */
var CONFIG = {
  AI: {
    model: 'claude-sonnet-5',
    maxTokens: 1200,
    apiVersion: '2023-06-01',
    endpoint: 'https://api.anthropic.com/v1/messages',
    /* Sonnet 5 rejects a non-default `temperature` outright, and runs thinking
       by default with max_tokens capping thinking and answer together — a
       short budget spends itself on thinking and truncates the JSON. This is
       structured extraction, so thinking is turned off rather than paid for. */
    thinking: { type: 'disabled' }
  },
  SHEETS: {
    Events:       ['eventId','eventName','startDate','endDate','venue','country','status','description','createdAt','updatedAt','deleted'],
    Leads:        ['leadId','eventId','companyId','fullName','jobTitle','email','phone','country','website','leadGrade','leadScore','status','assignedTo','interests','requests','notes','nextAction','nextActionDate','createdAt','updatedAt','deleted'],
    Companies:    ['companyId','companyName','website','country','industry','businessType','products','markets','employeeSize','description','aiSummary','aiFitScore','aiResearchStatus','researchSource','researchedAt','createdAt','updatedAt','deleted'],
    Interactions: ['interactionId','leadId','eventId','type','summary','notes','interests','requests','createdBy','createdAt','updatedAt','deleted'],
    FollowUps:    ['followUpId','leadId','eventId','type','scheduledAt','status','priority','reason','aiRecommended','aiReason','subject','body','approvedAt','sentAt','sentBy','gmailMessageId','errorMessage','createdAt','updatedAt','deleted'],
    EmailLogs:    ['emailId','followUpId','leadId','recipient','subject','status','provider','messageId','sentAt','errorMessage'],
    SyncLogs:     ['syncId','deviceId','entityType','entityId','action','status','timestamp','errorMessage']
  },
  /* Which object store maps onto which sheet and id column. */
  ENTITIES: {
    events:       {sheet:'Events',       idCol:'eventId'},
    leads:        {sheet:'Leads',        idCol:'leadId'},
    companies:    {sheet:'Companies',    idCol:'companyId'},
    interactions: {sheet:'Interactions', idCol:'interactionId'},
    followups:    {sheet:'FollowUps',    idCol:'followUpId'}
  },
  MAX_BATCH: 500
};

function prop_(name) {
  return PropertiesService.getScriptProperties().getProperty(name) || '';
}
