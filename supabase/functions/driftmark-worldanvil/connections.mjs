// Only the Edge Function's service client can execute these RPCs. No caller
// receives the decrypted token; it is used only for the fixed Action service.
export function createConnections(client) {
  async function rpc(name, parameters) {
    const { data, error } = await client.rpc(name, parameters);
    if (error) throw Error("Private connection storage unavailable.");
    return data;
  }
  return {
    async read(owner) {
      const token = await rpc("driftmark_wa_read", { p_owner: owner });
      if (token !== null && typeof token !== "string") throw Error("Invalid private connection response.");
      return token;
    },
    async write(owner, token) {
      await rpc("driftmark_wa_store", { p_owner: owner, p_token: token });
    },
    async remove(owner) {
      await rpc("driftmark_wa_forget", { p_owner: owner });
    }
  };
}
