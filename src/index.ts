#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { HeyReachClient } from "./heyreach-client.js";

// ─── Parse CLI args ──────────────────────────────────────────────────────────

function getApiKey(): string {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith("--api-key=")) {
      // Use substring to preserve '=' characters within the key itself
      return arg.substring("--api-key=".length);
    }
  }
  if (process.env.HEYREACH_API_KEY) {
    return process.env.HEYREACH_API_KEY;
  }
  console.error("Error: API key required. Use --api-key=YOUR_KEY or set HEYREACH_API_KEY env var");
  process.exit(1);
}

function getBaseUrl(): string {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith("--base-url=")) {
      return arg.substring("--base-url=".length);
    }
  }
  return process.env.HEYREACH_BASE_URL || "https://api.heyreach.io/api/public";
}

const apiKey = getApiKey();
const baseUrl = getBaseUrl();
const client = new HeyReachClient(apiKey, baseUrl);

// ─── Create MCP Server ───────────────────────────────────────────────────────

const server = new McpServer({
  name: "heyreach",
  version: "1.0.0",
});

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── API Key Check ───────────────────────────────────────────────────────────

server.tool("check_api_key", "Verify that the HeyReach API key is valid", {}, async () => {
  const result = await client.checkApiKey();
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

// ─── Campaign Management ─────────────────────────────────────────────────────

server.tool(
  "get_all_campaigns",
  "List all campaigns with pagination",
  {
    offset: z.number().optional().describe("Number of records to skip (default: 0)"),
    limit: z.number().min(1).max(100).optional().describe("Max campaigns to return (1-100, default: 50)"),
  },
  async ({ offset, limit }) => {
    const result = await client.getAllCampaigns(offset, limit);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_campaign_by_id",
  "Get detailed information about a specific campaign",
  {
    campaignId: z.number().describe("The campaign ID"),
  },
  async ({ campaignId }) => {
    const result = await client.getCampaignById(campaignId);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_campaign_sequence",
  "Get the current sequence (workflow) of a campaign. The returned object is compatible with create/update sequence endpoints.",
  {
    campaignId: z.number().describe("The campaign ID"),
  },
  async ({ campaignId }) => {
    const result = await client.getCampaignSequence(campaignId);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "create_campaign",
  `Create a fully configured campaign in DRAFT status. You must call start_campaign separately to activate it.
  
Node types for sequence: CONNECTION_REQUEST, MESSAGE, INMAIL, LIKE_POST, CHECK_IS_CONNECTION, CHECK_IS_OPEN_PROFILE, SEND_LEAD_TO_INSTANTLY, SEND_LEAD_TO_SMARTLEAD, END.

Payload fields:
- CONNECTION_REQUEST: { messages: [string], fallbackMessage: string, toBeWithdrawnAfterDays?: number } (messages array can contain one empty string for no note)
- MESSAGE: { messages: [string], fallbackMessage: string } (messages is array with your message text, fallbackMessage is used when personalization fails)
- INMAIL: { subject: string, messages: [string], fallbackMessage: string }
- LIKE_POST: {} (no payload needed)
- END: no payload needed

Sequence rules:
- Every path must terminate with an END node
- CONNECTION_REQUEST, CHECK_IS_CONNECTION, CHECK_IS_OPEN_PROFILE must have both conditionalNode and unconditionalNode
- MESSAGE nodes must have both conditionalNode (replied) and unconditionalNode (no reply)
- actionDelay: number of units to wait. Must be at least 3 hours between action nodes (use actionDelayUnit: "DAY" with value >= 1 for safety)
- actionDelayUnit: "HOUR" or "DAY" (required on every node including END)
- END nodes after a conditional (replied) path can use actionDelay: 0, actionDelayUnit: "HOUR"
- END nodes after unconditional (no reply) path should use actionDelay >= 1, actionDelayUnit: "DAY"`,
  {
    name: z.string().describe("Campaign name"),
    listId: z.number().optional().describe("Lead list ID to use"),
    accountIds: z.array(z.number()).optional().describe("LinkedIn sender account IDs"),
    sequence: z
      .any()
      .optional()
      .describe("Sequence tree (PublicSequenceNodeDto). See tool description for node types and rules."),
    schedule: z
      .object({
        timezone: z.string().optional().describe("IANA timezone (e.g. 'America/New_York')"),
        startDate: z.string().optional().describe("ISO date string for campaign start"),
        endDate: z.string().optional().describe("ISO date string for campaign end"),
        dailyStartTime: z.string().optional().describe("Daily start time (e.g. '09:00')"),
        dailyEndTime: z.string().optional().describe("Daily end time (e.g. '17:00')"),
        activeDays: z.array(z.string()).optional().describe("Active days (e.g. ['Monday','Tuesday',...])"),
      })
      .optional()
      .describe("Campaign schedule configuration"),
    excludeLeadsFromRunningCampaigns: z.boolean().optional().describe("Exclude leads already in running campaigns"),
    excludeLeadsFromFinishedCampaigns: z.boolean().optional().describe("Exclude leads from finished campaigns"),
    excludeConnections: z.boolean().optional().describe("Exclude existing connections"),
  },
  async (input) => {
    const result = await client.createCampaign(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "update_campaign_settings",
  "Update general settings of a campaign (name, list, exclusion options). Cannot be called on ACTIVE or COMPLETED campaigns. If SCHEDULED, reverts to DRAFT.",
  {
    campaignId: z.number().describe("The campaign ID"),
    name: z.string().optional().describe("New campaign name"),
    listId: z.number().optional().describe("New lead list ID"),
    excludeLeadsFromRunningCampaigns: z.boolean().optional(),
    excludeLeadsFromFinishedCampaigns: z.boolean().optional(),
    excludeConnections: z.boolean().optional(),
  },
  async (input) => {
    const result = await client.updateCampaignSettings(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "update_campaign_sequence",
  `Replace the sequence (automation workflow) of a campaign. For PAUSED campaigns, existing lead states are preserved. For SCHEDULED campaigns, reverts to DRAFT.

Node types: CONNECTION_REQUEST, MESSAGE, INMAIL, LIKE_POST, CHECK_IS_CONNECTION, CHECK_IS_OPEN_PROFILE, SEND_LEAD_TO_INSTANTLY, SEND_LEAD_TO_SMARTLEAD, END.

Payload fields:
- CONNECTION_REQUEST: { messages: [string], fallbackMessage: string, toBeWithdrawnAfterDays?: number } (messages array can contain one empty string for no note)
- MESSAGE: { messages: [string], fallbackMessage: string } (messages is array with your message text, fallbackMessage is used when personalization fails)
- INMAIL: { subject: string, messages: [string], fallbackMessage: string }
- LIKE_POST: {} (no payload needed)

Rules:
- Every path must end with END node
- CONNECTION_REQUEST/CHECK_IS_CONNECTION/CHECK_IS_OPEN_PROFILE need both conditionalNode + unconditionalNode
- MESSAGE nodes need both conditionalNode (replied) + unconditionalNode (no reply)
- actionDelay: 0-100 days
- actionDelayUnit: "HOUR" or "DAY" (required on every node including END)`,
  {
    campaignId: z.number().describe("The campaign ID"),
    sequence: z.any().describe("The full sequence tree (PublicSequenceNodeDto)"),
  },
  async ({ campaignId, sequence }) => {
    const result = await client.updateCampaignSequence({ campaignId, sequence });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "update_campaign_accounts",
  "Replace the entire list of LinkedIn sender accounts for a campaign. WARNING: This is a full replacement, not a merge. Removing an account from a PAUSED campaign stops leads assigned to it.",
  {
    campaignId: z.number().describe("The campaign ID"),
    accountIds: z.array(z.number()).describe("Full list of LinkedIn sender account IDs to assign"),
  },
  async ({ campaignId, accountIds }) => {
    const result = await client.updateCampaignAccounts({ campaignId, accountIds });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "update_campaign_schedule",
  "Replace the schedule of a campaign. Once started, startDate cannot be changed. For SCHEDULED campaigns, reverts to DRAFT.",
  {
    campaignId: z.number().describe("The campaign ID"),
    schedule: z
      .object({
        timezone: z.string().optional().describe("IANA timezone"),
        startDate: z.string().optional().describe("ISO date for start"),
        endDate: z.string().optional().describe("ISO date for end"),
        dailyStartTime: z.string().optional().describe("e.g. '09:00'"),
        dailyEndTime: z.string().optional().describe("e.g. '17:00'"),
        activeDays: z.array(z.string()).optional().describe("e.g. ['Monday','Tuesday',...]"),
      })
      .describe("Schedule configuration"),
  },
  async ({ campaignId, schedule }) => {
    const result = await client.updateCampaignSchedule({ campaignId, schedule });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "start_campaign",
  "Start a campaign (transitions from DRAFT/SCHEDULED to ACTIVE)",
  {
    campaignId: z.number().describe("The campaign ID to start"),
  },
  async ({ campaignId }) => {
    const result = await client.startCampaign(campaignId);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "pause_campaign",
  "Pause an active campaign",
  {
    campaignId: z.number().describe("The campaign ID to pause"),
  },
  async ({ campaignId }) => {
    const result = await client.pauseCampaign(campaignId);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "resume_campaign",
  "Resume a paused campaign",
  {
    campaignId: z.number().describe("The campaign ID to resume"),
  },
  async ({ campaignId }) => {
    const result = await client.resumeCampaign(campaignId);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── Lead Management ─────────────────────────────────────────────────────────

server.tool(
  "add_leads_to_campaign",
  "Add leads to an ACTIVE campaign (v2). Leads are also added to the campaign's assigned lead list. Supports custom personalization fields. IMPORTANT: firstName is required — leads without it will be silently ignored by HeyReach.",
  {
    campaignId: z.number().describe("Target campaign ID (must be ACTIVE)"),
    leads: z
      .array(
        z.object({
          profileUrl: z.string().describe("LinkedIn profile URL (required, primary identifier)"),
          firstName: z.string().describe("Lead's first name (required — leads without this are silently dropped)"),
          lastName: z.string().optional(),
          email: z.string().optional(),
          company: z.string().optional(),
          position: z.string().optional(),
          customFields: z
            .record(z.string(), z.string())
            .optional()
            .describe("Custom personalization fields as key-value pairs"),
        })
      )
      .describe("Array of leads to add"),
  },
  async ({ campaignId, leads }) => {
    const result = await client.addLeadsToCampaignV2({ campaignId, leads: leads as any });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_leads_from_list",
  "Get leads from a specific list with pagination",
  {
    listId: z.number().describe("The list ID"),
    offset: z.number().optional().describe("Records to skip (default: 0)"),
    limit: z.number().min(1).max(100).optional().describe("Max results (1-100, default: 50)"),
  },
  async ({ listId, offset, limit }) => {
    const result = await client.getLeadsFromList(listId, offset, limit);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_lists_for_lead",
  "Get all lists that contain a specific lead by their LinkedIn profile URL",
  {
    profileUrl: z.string().describe("LinkedIn profile URL of the lead"),
  },
  async ({ profileUrl }) => {
    const result = await client.getListsForLead(profileUrl);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "stop_lead_in_campaign",
  "Stop a lead that is currently being processed in a campaign",
  {
    campaignId: z.number().describe("The campaign ID"),
    profileUrl: z.string().describe("LinkedIn profile URL of the lead to stop"),
  },
  async ({ campaignId, profileUrl }) => {
    const result = await client.stopLeadInCampaign(campaignId, profileUrl);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_companies_from_list",
  "Get companies from a company list with pagination",
  {
    listId: z.number().describe("The company list ID"),
    offset: z.number().optional().describe("Records to skip (default: 0)"),
    limit: z.number().min(1).max(100).optional().describe("Max results (1-100, default: 50)"),
  },
  async ({ listId, offset, limit }) => {
    const result = await client.getCompaniesFromList(listId, offset, limit);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── List Management ─────────────────────────────────────────────────────────

server.tool(
  "get_all_lists",
  "Get all lead/company lists with pagination",
  {
    offset: z.number().optional().describe("Records to skip (default: 0)"),
    limit: z.number().min(1).max(100).optional().describe("Max results (1-100, default: 50)"),
  },
  async ({ offset, limit }) => {
    const result = await client.getAllLists(offset, limit);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "create_list",
  "Create a new empty lead list",
  {
    name: z.string().describe("List name"),
  },
  async ({ name }) => {
    const result = await client.createEmptyList(name);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "add_leads_to_list",
  "Add leads to an existing list (v2). IMPORTANT: firstName is required — leads without it will be silently ignored by HeyReach.",
  {
    listId: z.number().describe("Target list ID"),
    leads: z
      .array(
        z.object({
          profileUrl: z.string().describe("LinkedIn profile URL (required)"),
          firstName: z.string().describe("Lead's first name (required — leads without this are silently dropped)"),
          lastName: z.string().optional(),
          email: z.string().optional(),
          company: z.string().optional(),
          position: z.string().optional(),
          customFields: z.record(z.string(), z.string()).optional(),
        })
      )
      .describe("Array of leads to add"),
  },
  async ({ listId, leads }) => {
    const result = await client.addLeadsToListV2({ listId, leads: leads as any });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── LinkedIn Account Management ─────────────────────────────────────────────

server.tool(
  "get_all_linkedin_accounts",
  "Get all connected LinkedIn sender accounts",
  {},
  async () => {
    const result = await client.getAllLinkedInAccounts();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── Inbox / Conversations ───────────────────────────────────────────────────

server.tool(
  "get_conversations",
  "Retrieve LinkedIn conversations with filtering options",
  {
    accountIds: z.array(z.number()).optional().describe("Filter by LinkedIn account IDs"),
    campaignIds: z.array(z.number()).optional().describe("Filter by campaign IDs"),
    offset: z.number().optional().describe("Records to skip"),
    limit: z.number().min(1).max(100).optional().describe("Max results (1-100)"),
    search: z.string().optional().describe("Search text in conversations"),
    unreadOnly: z.boolean().optional().describe("Only return unread conversations"),
  },
  async (input) => {
    const result = await client.getConversations(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "send_message",
  "Send a LinkedIn message to a profile via a specific sender account",
  {
    accountId: z.number().describe("LinkedIn sender account ID to send from"),
    profileUrl: z.string().describe("Target LinkedIn profile URL"),
    message: z.string().describe("Message content to send"),
  },
  async ({ accountId, profileUrl, message }) => {
    const result = await client.sendMessage({ accountId, profileUrl, message });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── Analytics / Stats ────────────────────────────────────────────────────

server.tool(
  "get_overall_stats",
  "Get overall performance stats (daily breakdown + totals) for given accounts and optionally filtered by campaigns. Returns connections sent/accepted, messages, replies, InMails, reply rates, etc.",
  {
    accountIds: z.array(z.number()).describe("LinkedIn sender account IDs (required)"),
    campaignIds: z.array(z.number()).optional().describe("Filter by campaign IDs (optional)"),
    startDate: z.string().optional().describe("Start date ISO string (optional)"),
    endDate: z.string().optional().describe("End date ISO string (optional)"),
  },
  async (input) => {
    const result = await client.getOverallStats(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── Lead Tags ───────────────────────────────────────────────────────────────

server.tool(
  "get_lead_tags",
  "Get all tags assigned to a specific lead by their LinkedIn profile URL",
  {
    profileUrl: z.string().describe("LinkedIn profile URL of the lead"),
  },
  async ({ profileUrl }) => {
    const result = await client.getLeadTags(profileUrl);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "add_lead_tags",
  "Add tags to a lead by their LinkedIn profile URL. The lead must exist in at least one list.",
  {
    profileUrl: z.string().describe("LinkedIn profile URL of the lead"),
    tags: z.array(z.string()).describe("Array of tag names to add"),
  },
  async ({ profileUrl, tags }) => {
    const result = await client.addLeadTags(profileUrl, tags);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ─── Start Server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
