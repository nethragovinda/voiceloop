
import { randomUUID } from "node:crypto";
import type {
  OAuthClientInformationFull,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type {
  OAuthRegisteredClientsStore,
} from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { supabase } from "../config/supabase.js";

export const oauthClientsStore: OAuthRegisteredClientsStore = {
  async getClient(clientId: string) {
    const { data, error } = await supabase
      .from("oauth_clients")
      .select("client_data")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not retrieve OAuth client: ${error.message}`);
    }

    if (!data) {
      return undefined;
    }

    return data.client_data as OAuthClientInformationFull;
  },

  async registerClient(client) {
    const registeredClient: OAuthClientInformationFull = {
      ...client,
      client_id: randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };

    const { error } = await supabase
      .from("oauth_clients")
      .insert({
        client_id: registeredClient.client_id,
        client_data: registeredClient,
      });

    if (error) {
      throw new Error(`Could not register OAuth client: ${error.message}`);
    }

    return registeredClient;
  },
};
