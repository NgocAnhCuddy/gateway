import { LIST_NAME_PREFIX } from "./sync-lists.js";

export const DNS_RULE_NAME = "CGPS Filter Lists";
export const SNI_RULE_NAME = "CGPS Filter Lists - SNI Based Filtering";

/**
 * Builds a Wirefilter expression matching DNS/SNI queries against every
 * managed list, then creates or updates the corresponding Gateway rule.
 *
 * @param {import("../cloudflare/gateway-client.js").GatewayClient} client
 * @param {{ id: string, name: string }[]} lists
 * @param {"dns" | "sni"} kind
 */
export const upsertRule = async (client, lists, kind) => {
  const managed = lists.filter((l) => l.name.startsWith(LIST_NAME_PREFIX));
  const field = kind === "dns" ? "dns.domains" : "net.sni.domains";
  const expression = managed.map(({ id }) => `any(${field}[*] in $${id})`).join(" or ");
  const name = kind === "dns" ? DNS_RULE_NAME : SNI_RULE_NAME;
  const filters = kind === "dns" ? ["dns"] : ["l4"];

  const { result: existingRules } = await client.listRules();
  const existing = existingRules.find((r) => r.name === name);

  const blockPageEnabled = process.env.BLOCK_PAGE_ENABLED === "1";
  const ruleBody = { name, expression, filters, blockPageEnabled };

  if (existing) {
    console.log(`Updating rule "${name}"...`);
    return client.updateRule(existing.id, ruleBody);
  }
  console.log(`Creating rule "${name}"...`);
  return client.createRule(ruleBody);
};

/**
 * Deletes all managed rules. Used by the delete/teardown CLI.
 * @param {import("../cloudflare/gateway-client.js").GatewayClient} client
 */
export const deleteAllManagedRules = async (client) => {
  const { result: rules } = await client.listRules();
  const managed = rules.filter((r) => r.name.startsWith("CGPS Filter Lists"));
  for (const rule of managed) {
    console.log(`Deleting rule "${rule.name}"...`);
    await client.deleteRule(rule.id);
  }
  return managed.length;
};
