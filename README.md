# heyreach-mcp-campaign

A Model Context Protocol (MCP) server providing full API coverage for [HeyReach](https://heyreach.io) LinkedIn automation — including the new Campaign API for programmatic campaign creation.

## Features

- **Full Campaign API** — Create, configure, start/pause/resume campaigns programmatically
- **Sequence Builder** — Define automation workflows with connection requests, messages, InMails, conditions
- **Lead Management** — Add leads to campaigns/lists with custom personalization fields
- **List Management** — Create and manage lead/company lists
- **LinkedIn Accounts** — View connected senders
- **Inbox** — Read conversations and send messages

## Available Tools (26 total)

| Tool | Description |
|------|-------------|
| `check_api_key` | Verify API key validity |
| `get_all_campaigns` | List campaigns with pagination |
| `get_campaign_by_id` | Get campaign details |
| `get_campaign_sequence` | Get campaign workflow tree |
| `create_campaign` | Create a new campaign (DRAFT) |
| `update_campaign_settings` | Update name, list, exclusions |
| `update_campaign_sequence` | Replace campaign workflow |
| `update_campaign_accounts` | Replace sender accounts |
| `update_campaign_schedule` | Replace schedule config |
| `start_campaign` | Activate a draft campaign |
| `pause_campaign` | Pause an active campaign |
| `resume_campaign` | Resume a paused campaign |
| `add_leads_to_campaign` | Add leads to active campaign (v2) |
| `get_leads_from_list` | Get leads from a list |
| `get_lists_for_lead` | Find which lists contain a lead |
| `stop_lead_in_campaign` | Stop a lead mid-campaign |
| `get_companies_from_list` | Get companies from a company list |
| `get_all_lists` | List all lead/company lists |
| `create_list` | Create empty list |
| `add_leads_to_list` | Add leads to a list (v2) |
| `get_all_linkedin_accounts` | List connected senders |
| `get_conversations` | Read inbox conversations |
| `send_message` | Send a LinkedIn message |
| `get_overall_stats` | Get performance stats (daily + totals) |
| `get_lead_tags` | Get tags for a lead |
| `add_lead_tags` | Add tags to a lead |

## Installation

### Via npx (quickest)

```bash
npx heyreach-mcp-campaign
```

### From source

```bash
git clone https://github.com/oxtx/heyreach-mcp-campaign.git
cd heyreach-mcp-campaign
npm install
npm run build
npm start
```

## MCP Client Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "heyreach": {
      "command": "npx",
      "args": ["heyreach-mcp-campaign"],
      "env": {
        "HEYREACH_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Kiro

Add to `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "heyreach": {
      "command": "npx",
      "args": ["heyreach-mcp-campaign"],
      "env": {
        "HEYREACH_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Cursor / Windsurf

Same format in your MCP settings:

```json
{
  "mcpServers": {
    "heyreach": {
      "command": "npx",
      "args": ["heyreach-mcp-campaign"],
      "env": {
        "HEYREACH_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Usage Examples

### Create a campaign with a connection request → message sequence

```
Use create_campaign with:
- name: "CMO Outreach Q1"
- listId: 12345
- accountIds: [111, 222]
- sequence: {
    nodeType: "CONNECTION_REQUEST",
    actionDelay: 0,
    actionDelayUnit: "HOUR",
    payload: { messages: ["Hi {FIRST_NAME}, I'd love to connect!"] },
    conditionalNode: {
      nodeType: "MESSAGE",
      actionDelay: 1,
      actionDelayUnit: "DAY",
      payload: {
        messages: ["Thanks for connecting! I wanted to share..."],
        fallbackMessage: "Thanks for connecting! I wanted to share..."
      },
      conditionalNode: { nodeType: "END", actionDelay: 0, actionDelayUnit: "HOUR" },
      unconditionalNode: { nodeType: "END", actionDelay: 1, actionDelayUnit: "DAY" }
    },
    unconditionalNode: { nodeType: "END", actionDelay: 14, actionDelayUnit: "DAY" }
  }
```

Then call `start_campaign` with the returned campaignId.

### Add leads from Clay/external source

```
Use add_leads_to_campaign with:
- campaignId: 12345
- leads: [
    {
      profileUrl: "https://linkedin.com/in/johndoe",
      firstName: "John",
      lastName: "Doe",
      company: "Acme Inc",
      customFields: { "icebreaker": "Loved your recent post about AI" }
    }
  ]
```

## API Key Setup

1. Log in to your HeyReach account at [app.heyreach.io](https://app.heyreach.io)
2. Click the **gear icon** (Settings) in the bottom-left sidebar
3. Go to **Integrations** tab
4. Scroll to the **API Keys** section
5. Click **"New API Key"**
6. Give it a name (e.g. "MCP Server") and click **Create**
7. Copy the generated key immediately — it won't be shown again

Use it via environment variable (recommended):

```bash
export HEYREACH_API_KEY=your_key_here
```

Or via CLI argument:

```bash
npx heyreach-mcp-campaign --api-key=your_key_here
```

> **Note:** API keys are tied to your workspace. If you manage multiple workspaces (agency accounts), each workspace has its own key.

## Sequence Node Types

| Type | Description | Requires both branches? |
|------|-------------|------------------------|
| `CONNECTION_REQUEST` | Send connection request | Yes (conditional + unconditional) |
| `MESSAGE` | Send message to connection | Yes (replied + no reply) |
| `INMAIL` | Send InMail | No |
| `LIKE_POST` | Like a lead's post | No |
| `CHECK_IS_CONNECTION` | Branch on connection status | Yes |
| `CHECK_IS_OPEN_PROFILE` | Branch on Open Profile | Yes |
| `SEND_LEAD_TO_INSTANTLY` | Export to Instantly | No |
| `SEND_LEAD_TO_SMARTLEAD` | Export to Smartlead | No |
| `END` | Terminal node | N/A |

### Sequence Rules

- Every path must terminate with an `END` node
- `actionDelayUnit` is required: `"HOUR"` or `"DAY"`
- Minimum 3 hours delay between action nodes (use `actionDelayUnit: "DAY"` with value >= 1)
- END nodes after a conditional (replied) path can use `actionDelay: 0, actionDelayUnit: "HOUR"`
- END nodes after unconditional (no reply) path should use `actionDelay >= 1, actionDelayUnit: "DAY"`

## License

MIT
