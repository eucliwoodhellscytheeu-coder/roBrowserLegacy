/** Project map coordinates with the same axis convention as EntityRender. */
export function projectMapPoint(position, camera, viewport) {
	const point = [position[0] + 0.5, -(position[2] || 0), position[1] + 0.5, 1];
	const transform = (matrix, value) =>
		[0, 1, 2, 3].map(
			row =>
				matrix[row] * value[0] +
				matrix[4 + row] * value[1] +
				matrix[8 + row] * value[2] +
				matrix[12 + row] * value[3]
		);
	const clip = transform(camera.projection, transform(camera.modelView, point));
	if (!Number.isFinite(clip[3]) || Math.abs(clip[3]) < 0.00001) {
		return null;
	}
	return [((clip[0] / clip[3]) * viewport.width) / 2, ((-clip[1] / clip[3]) * viewport.height) / 2];
}

/** Invert the local projected ground plane, rather than assuming a camera yaw sign. */
export function screenVectorToMap(position, vector, camera, viewport = { width: 1, height: 1 }) {
	let direction;
	if (
		typeof camera === 'object' &&
		camera.modelView &&
		camera.projection &&
		viewport.width > 0 &&
		viewport.height > 0
	) {
		const origin = projectMapPoint(position, camera, viewport);
		const east = projectMapPoint([position[0] + 0.001, position[1], position[2]], camera, viewport);
		const north = projectMapPoint([position[0], position[1] + 0.001, position[2]], camera, viewport);
		if (origin && east && north) {
			const a = east[0] - origin[0];
			const b = north[0] - origin[0];
			const c = east[1] - origin[1];
			const d = north[1] - origin[1];
			const determinant = a * d - b * c;
			if (Math.abs(determinant) > 0.000000000001) {
				direction = [
					(d * vector[0] - b * vector[1]) / determinant,
					(a * vector[1] - c * vector[0]) / determinant
				];
			}
		}
	}
	if (!direction) {
		const yaw = ((typeof camera === 'number' ? camera : camera.angle[1]) * Math.PI) / 180;
		const pitch = ((typeof camera === 'number' ? 270 : camera.angle[0]) * Math.PI) / 180;
		const vertical = vector[1] / Math.max(0.1, -Math.sin(pitch));
		direction = [
			vector[0] * Math.cos(yaw) + vertical * Math.sin(yaw),
			vector[0] * Math.sin(yaw) - vertical * Math.cos(yaw)
		];
	}
	const length = Math.hypot(...direction);
	return length > 0 ? direction.map(value => value / length) : [0, 0];
}
