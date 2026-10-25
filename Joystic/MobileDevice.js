/** Phones/tablets only: touch capability alone also matches many laptops. */
export function isMobileDevice(device = globalThis.navigator) {
	if (!device) {
		return false;
	}
	if (device.userAgentData?.mobile === true) {
		return true;
	}
	if (/Android|iPhone|iPad|iPod|IEMobile|Windows Phone/i.test(device.userAgent || '')) {
		return true;
	}
	// iPadOS can request desktop sites and identify itself as a Macintosh.
	const macIdentity = device.platform === 'MacIntel' || /Macintosh/i.test(device.userAgent || '');
	return macIdentity && device.maxTouchPoints > 1;
}
