export const CATEGORIES = ["Sales", "Support", "Billing", "Technical", "Other"] as const;
export const OWNERS = ["Sales Team", "Client Success", "Finance", "Engineering"] as const;
export const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Owner = (typeof OWNERS)[number];
export type Priority = (typeof PRIORITIES)[number];

export const CATEGORY_DEFINITIONS: Record<Category, string> = {
  Sales:
    "Prospect/client exploring new or expanded paid work, pricing, proposals, demos, custom builds, new automation, or meetings.",
  Support:
    "Existing client using/getting value, nothing broken. How-to questions, onboarding, individual account/permission changes, product questions, feature requests, feedback.",
  Billing:
    "Money on existing work: invoices, duplicate charges, payment terms, refunds, receipts.",
  Technical:
    "Defect/failure in our systems, systemic issues/outages, insecure/exposed data, integrations, performance, or implementation issues requiring engineering in existing deployments.",
  Other:
    "Spam, vendors, recruiting, press, gibberish, or requests that do not fit the business categories.",
};

export const CATEGORY_TIE_BREAKERS: readonly string[] = [
  "Systemic failure/security/exposure → Technical",
  "Existing money → Billing",
  "New paid work/scoping/building → Sales",
  "Existing use/how-to with nothing broken → Support",
  "Otherwise → Other",
];

// "Broken" means a defect/failure in our systems.
export const CATEGORY_BOUNDARY_NOTES: readonly string[] = [
  "A single-user access issue is Support.",
  "A systemic inability for users to log in is Technical.",
  "Existing deployment implementation work is Technical.",
  "New scoping/building/custom work is Sales.",
];

export const PRIORITY_DEFINITIONS: Record<Priority, string> = {
  Urgent:
    "Active/imminent harm, security/privacy exposure, business-critical system unavailable for many users/halting operations, or money being lost now.",
  High: "Concrete deadline around a week with consequence, impaired functionality with workaround, or time-sensitive commercial opportunity.",
  Medium:
    "Default genuine actionable request, soft/no timeline, leads, questions, or nonblocking bugs.",
  Low: "Ideas, feedback, or informational requests where nothing meaningful is lost by waiting a week or more.",
};

export const PRIORITY_RULES: readonly string[] = [
  "Impact is primary.",
  "Deadline is secondary.",
  "Tone is tertiary.",
  "Urgency language is only a hint.",
  "Explicit calm wording must not cap severe impact.",
  "Adjacent uncertainty chooses the higher priority and sets needsReview.",
];

// The LLM never chooses the owner; it is derived from the final category.
export const OWNER_BY_CATEGORY: Record<Category, Owner> = {
  Sales: "Sales Team",
  Support: "Client Success",
  Billing: "Finance",
  Technical: "Engineering",
  Other: "Client Success",
};
