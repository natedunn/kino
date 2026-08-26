export function shouldStopLocalBackend({ resetLocalState, stopRunningLocal, target }) {
	return !target && (resetLocalState || stopRunningLocal);
}

export function planLocalDeploymentReset(deploymentName, { resetLocalState }) {
	if (typeof deploymentName !== 'string' || !deploymentName) return null;
	if (deploymentName === 'anonymous-agent' && !resetLocalState) return null;

	return {
		reason:
			deploymentName === 'anonymous-agent'
				? 'fresh local seed requested'
				: `local deployment is "${deploymentName}", not "anonymous-agent"`,
	};
}
