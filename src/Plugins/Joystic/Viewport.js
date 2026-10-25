/** GUIComponent creates the host; size it explicitly when attaching the overlay. */
export function sizeOverlay(component, viewport = window) {
	const host = component._host;
	if (!host) {
		return;
	}
	Object.assign(host.style, {
		position: 'fixed',
		top: '0px',
		left: '0px',
		width: `${viewport.innerWidth}px`,
		height: `${viewport.innerHeight}px`,
		pointerEvents: 'none'
	});
}
