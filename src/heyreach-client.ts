/**
 * HeyReach API Client
 * Base URL: https://api.heyreach.io/api/public
 * Auth: X-API-KEY header
 */

export class HeyReachClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl = "https://api.heyreach.io/api/public") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | number | undefined>
  ): Promise<unknown> {
    let url = `${this.baseUrl}${path}`;

    if (queryParams) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      "X-API-KEY": this.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HeyReach API error ${response.status}: ${errorText || response.statusText}`
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json();
    }

    const text = await response.text();
    return text || { success: true };
  }

  // ─── Campaign Management ───────────────────────────────────────────

  /** Get all campaigns with pagination */
  async getAllCampaigns(offset = 0, limit = 50) {
    return this.request("POST", "/campaign/GetAll", { offset, limit });
  }

  /** Get campaign by ID */
  async getCampaignById(campaignId: number) {
    return this.request("GET", "/campaign/GetById", undefined, { campaignId });
  }

  /** Get campaign sequence */
  async getCampaignSequence(campaignId: number) {
    return this.request("GET", "/campaign/GetCampaignSequence", undefined, { campaignId });
  }

  /** Create a new campaign (DRAFT status) */
  async createCampaign(input: CreateCampaignInput) {
    const body: Record<string, unknown> = { name: input.name };
    if (input.listId !== undefined) body.linkedInUserListId = input.listId;
    if (input.accountIds !== undefined) body.linkedInAccountIds = input.accountIds;
    if (input.schedule !== undefined) body.schedule = input.schedule;
    if (input.sequence !== undefined) body.sequence = input.sequence;
    if (input.excludeLeadsFromRunningCampaigns !== undefined)
      body.excludeLeadsFromRunningCampaigns = input.excludeLeadsFromRunningCampaigns;
    if (input.excludeLeadsFromFinishedCampaigns !== undefined)
      body.excludeLeadsFromFinishedCampaigns = input.excludeLeadsFromFinishedCampaigns;
    if (input.excludeConnections !== undefined)
      body.excludeConnections = input.excludeConnections;
    return this.request("POST", "/campaign/Create", body);
  }

  /** Update campaign settings */
  async updateCampaignSettings(input: UpdateCampaignSettingsInput) {
    const body: Record<string, unknown> = { campaignId: input.campaignId };
    if (input.name !== undefined) body.name = input.name;
    if (input.listId !== undefined) body.linkedInUserListId = input.listId;
    if (input.excludeLeadsFromRunningCampaigns !== undefined)
      body.excludeLeadsFromRunningCampaigns = input.excludeLeadsFromRunningCampaigns;
    if (input.excludeLeadsFromFinishedCampaigns !== undefined)
      body.excludeLeadsFromFinishedCampaigns = input.excludeLeadsFromFinishedCampaigns;
    if (input.excludeConnections !== undefined)
      body.excludeConnections = input.excludeConnections;
    // API requires linkedInUserListId — fetch from campaign if not provided
    if (!body.linkedInUserListId) {
      const campaign = (await this.getCampaignById(input.campaignId)) as any;
      if (campaign?.linkedInUserListId) {
        body.linkedInUserListId = campaign.linkedInUserListId;
      }
    }
    return this.request("POST", "/campaign/UpdateSettings", body);
  }

  /** Update campaign sequence */
  async updateCampaignSequence(input: UpdateCampaignSequenceInput) {
    return this.request("POST", "/campaign/UpdateSequence", input);
  }

  /** Update campaign accounts (sender LinkedIn accounts) */
  async updateCampaignAccounts(input: UpdateCampaignAccountsInput) {
    return this.request("POST", "/campaign/UpdateAccounts", {
      campaignId: input.campaignId,
      linkedInAccountIds: input.accountIds,
    });
  }

  /** Update campaign schedule */
  async updateCampaignSchedule(input: UpdateCampaignScheduleInput) {
    return this.request("POST", "/campaign/UpdateSchedule", input);
  }

  /** Start a campaign */
  async startCampaign(campaignId: number) {
    return this.request("POST", "/campaign/StartCampaign", undefined, { campaignId });
  }

  /** Pause a campaign */
  async pauseCampaign(campaignId: number) {
    return this.request("POST", "/campaign/Pause", undefined, { campaignId });
  }

  /** Resume a campaign */
  async resumeCampaign(campaignId: number) {
    return this.request("POST", "/campaign/Resume", undefined, { campaignId });
  }

  // ─── Lead Management ───────────────────────────────────────────────

  /** Add leads to campaign (v2) */
  async addLeadsToCampaignV2(input: AddLeadsToCampaignV2Input) {
    return this.request("POST", "/campaign/AddLeadsToCampaignV2", input);
  }

  /** Get lead by profile URL — NOTE: may not be available on all API plans */
  async getLeadByProfileUrl(profileUrl: string) {
    return this.request("POST", "/lead/GetByProfileUrl", { profileUrl });
  }

  /** Get leads from a list */
  async getLeadsFromList(listId: number, offset = 0, limit = 50) {
    return this.request("POST", "/list/GetLeadsFromList", { listId, offset, limit });
  }

  /** Get all lists that contain a specific lead */
  async getListsForLead(profileUrl: string) {
    return this.request("POST", "/list/GetListsForLead", { profileUrl });
  }

  /** Delete a lead from a list */
  async deleteLeadFromList(listId: number, profileUrl: string) {
    return this.request("POST", "/lead/DeleteFromList", { listId, profileUrl });
  }

  /** Stop a lead in a campaign */
  async stopLeadInCampaign(campaignId: number, profileUrl: string) {
    return this.request("POST", "/campaign/StopLeadInCampaign", { campaignId, leadUrl: profileUrl });
  }

  // ─── List Management ───────────────────────────────────────────────

  /** Get companies from a company list */
  async getCompaniesFromList(listId: number, offset = 0, limit = 50) {
    return this.request("POST", "/list/GetCompaniesFromList", { listId, offset, limit });
  }

  /** Get all lists */
  async getAllLists(offset = 0, limit = 50) {
    return this.request("POST", "/list/GetAll", { offset, limit });
  }

  /** Create an empty list */
  async createEmptyList(name: string) {
    return this.request("POST", "/list/CreateEmptyList", { name, input: "" });
  }

  /** Add leads to a list (v2) */
  async addLeadsToListV2(input: AddLeadsToListV2Input) {
    return this.request("POST", "/list/AddLeadsToListV2", input);
  }

  // ─── LinkedIn Account Management ──────────────────────────────────

  /** Get all LinkedIn accounts */
  async getAllLinkedInAccounts() {
    return this.request("POST", "/li_account/GetAll", {});
  }

  /** Get my network for a sender */
  async getMyNetworkForSender(
    accountId: number,
    offset = 0,
    limit = 50,
    search?: string
  ) {
    return this.request("POST", "/li_account/GetMyNetworkForSender", {
      accountId,
      offset,
      limit,
      search,
    });
  }

  // ─── Inbox / Conversations ─────────────────────────────────────────

  /** Get conversations */
  async getConversations(input: GetConversationsInput) {
    return this.request("POST", "/inbox/GetConversationsV2", input);
  }

  /** Send a message */
  async sendMessage(input: SendMessageInput) {
    return this.request("POST", "/inbox/SendMessage", input);
  }

  // ─── Analytics / Stats ──────────────────────────────────────────────

  /** Get overall stats (daily breakdown + totals) */
  async getOverallStats(input: GetStatsInput) {
    return this.request("POST", "/stats/GetOverallStats", input);
  }

  // ─── Lead Tags ────────────────────────────────────────────────────────

  /** Get tags for a lead */
  async getLeadTags(profileUrl: string) {
    return this.request("POST", "/lead/GetTags", { ProfileUrl: profileUrl });
  }

  /** Add tags to a lead */
  async addLeadTags(profileUrl: string, tags: string[]) {
    return this.request("POST", "/lead/AddTags", { leadProfileUrl: profileUrl, tags });
  }

  // ─── API Key Validation ────────────────────────────────────────────

  /** Check if API key is valid */
  async checkApiKey() {
    // Use a lightweight call to verify the key
    try {
      await this.request("POST", "/campaign/GetAll", { offset: 0, limit: 1 });
      return { valid: true };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }
}

// ─── Types ─────────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  name: string;
  listId?: number;
  accountIds?: number[];
  schedule?: CampaignScheduleDto;
  sequence?: SequenceNodeDto;
  excludeLeadsFromRunningCampaigns?: boolean;
  excludeLeadsFromFinishedCampaigns?: boolean;
  excludeConnections?: boolean;
}

export interface UpdateCampaignSettingsInput {
  campaignId: number;
  name?: string;
  listId?: number;
  excludeLeadsFromRunningCampaigns?: boolean;
  excludeLeadsFromFinishedCampaigns?: boolean;
  excludeConnections?: boolean;
}

export interface UpdateCampaignSequenceInput {
  campaignId: number;
  sequence: SequenceNodeDto;
}

export interface UpdateCampaignAccountsInput {
  campaignId: number;
  accountIds: number[];
}

export interface UpdateCampaignScheduleInput {
  campaignId: number;
  schedule: CampaignScheduleDto;
}

export interface CampaignScheduleDto {
  timezone?: string;
  startDate?: string;
  endDate?: string;
  dailyStartTime?: string;
  dailyEndTime?: string;
  activeDays?: string[];
}

export interface SequenceNodeDto {
  nodeType: string;
  actionDelay?: number;
  actionDelayUnit?: string;
  payload?: Record<string, unknown>;
  unconditionalNode?: SequenceNodeDto;
  conditionalNode?: SequenceNodeDto;
}

export interface AddLeadsToCampaignV2Input {
  campaignId: number;
  leads: LeadInput[];
}

export interface LeadInput {
  profileUrl?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  position?: string;
  customFields?: Record<string, string>;
}

export interface AddLeadsToListV2Input {
  listId: number;
  leads: LeadInput[];
}

export interface GetConversationsInput {
  accountIds?: number[];
  campaignIds?: number[];
  offset?: number;
  limit?: number;
  search?: string;
  unreadOnly?: boolean;
}

export interface SendMessageInput {
  accountId: number;
  profileUrl: string;
  message: string;
}

export interface GetStatsInput {
  accountIds: number[];
  campaignIds?: number[];
  startDate?: string;
  endDate?: string;
}
