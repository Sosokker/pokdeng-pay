export default {
	async scheduled(_event: any, env: Record<string, string>, _ctx: any) {
		const baseUrl = `https://pokdeng-promptpay.${env.CF_ACCOUNT_HOSTNAME || "workers.dev"}`;
		await fetch(`${baseUrl}/api/cron/cleanup`, {
			method: "POST",
			headers: { Authorization: `Bearer ${env.CRON_SECRET ?? ""}` },
		});
	},
};
