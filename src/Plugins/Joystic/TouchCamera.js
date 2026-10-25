import Camera from 'Renderer/Camera.js';
import Renderer from 'Renderer/Renderer.js';
import DB from 'DB/DBManager.js';
import Session from 'Engine/SessionStorage.js';
import Mobile from 'Core/Mobile.js';
import Mouse from 'Controls/MouseEventHandler.js';
import { CameraGestures } from './CameraGestures.js';

export default function installTouchCamera() {
	const gestures = new CameraGestures(
		Camera,
		() => {
			const indoor = DB.isIndoor(Camera.currentMap);
			const range = Math.abs(Camera.altitudeTo - Camera.altitudeFrom);
			return {
				zoomMin: Math.max(2, range * Camera.MIN_ZOOM),
				zoomMax: range * (indoor ? Camera.MAX_ZOOM_INDOOR : Camera.MAX_ZOOM),
				pitchMin: indoor ? Camera.MIN_ALTITUDE_INDOOR : Camera.MIN_V_ANGLE,
				pitchMax: indoor ? Camera.MAX_ALTITUDE_INDOOR : Camera.MAX_V_ANGLE,
				...(indoor ? { yawMin: Camera.indoorRotationFrom, yawMax: Camera.indoorRotationTo } : {})
			};
		},
		() => ({ width: Renderer.width, height: Renderer.height })
	);
	let sequence = null;
	let timer;
	const point = touch => {
		Mouse.screen.x = touch.clientX;
		Mouse.screen.y = touch.clientY;
	};
	const endPress = () => {
		if (sequence?.pressed) {
			Mobile.onTouchEnd?.();
			sequence.pressed = false;
		}
	};
	const cancel = () => {
		window.clearTimeout(timer);
		endPress();
		gestures.end();
		sequence = null;
		Mouse.intersect = false;
	};
	const consume = event => {
		event.preventDefault();
		event.stopImmediatePropagation();
	};
	const canvasTouches = event => Array.from(event.touches).filter(touch => touch.target === Renderer.canvas);
	const ownsEvent = event => Array.from(event.changedTouches).some(touch => touch.target === Renderer.canvas);
	window.addEventListener(
		'touchstart',
		event => {
			if (!ownsEvent(event) || !Session.Entity || !Renderer.rendering || Session.FreezeUI) {
				return;
			}
			const touches = canvasTouches(event);
			consume(event);
			if (touches.length >= 2) {
				window.clearTimeout(timer);
				endPress();
				sequence = { gesture: true, pressed: false, player: Session.Entity };
				Mouse.intersect = false;
				gestures.begin(touches);
			} else if (touches.length === 1) {
				cancel();
				point(touches[0]);
				sequence = { gesture: false, pressed: false, released: false, player: Session.Entity };
				const pending = sequence;
				// A canvas finger used alongside joystick/shortcut fingers is not a map tap.
				if (event.touches.length !== 1) {
					return;
				}
				Mouse.intersect = true;
				timer = window.setTimeout(() => {
					if (
						sequence !== pending ||
						pending.player !== Session.Entity ||
						Session.FreezeUI ||
						document.hidden ||
						!Renderer.rendering
					) {
						cancel();
						return;
					}
					Mouse.intersect = true;
					Mobile.onTouchStart?.();
					pending.pressed = true;
					if (pending.released) {
						endPress();
						sequence = null;
						Mouse.intersect = false;
					}
				}, 200);
			}
		},
		{ capture: true, passive: false }
	);
	window.addEventListener(
		'touchmove',
		event => {
			if (!sequence || !ownsEvent(event)) {
				return;
			}
			consume(event);
			const touches = canvasTouches(event);
			if (sequence.gesture) {
				if (touches.length >= 2) {
					gestures.move(touches);
				}
			} else if (touches[0]) {
				point(touches[0]);
				if (sequence.pressed) {
					Mobile.onTouchMove?.(event);
				}
			}
		},
		{ capture: true, passive: false }
	);
	window.addEventListener(
		'touchend',
		event => {
			if (!sequence || !ownsEvent(event)) {
				return;
			}
			consume(event);
			const touches = canvasTouches(event);
			if (sequence.gesture) {
				if (touches.length < 2) {
					gestures.end();
				}
				if (!touches.length) {
					cancel();
				}
			} else if (!touches.length) {
				sequence.released = true;
				if (sequence.pressed) {
					cancel();
				}
			}
		},
		{ capture: true, passive: false }
	);
	window.addEventListener(
		'touchcancel',
		event => {
			if (sequence && ownsEvent(event)) {
				consume(event);
				cancel();
			}
		},
		{ capture: true, passive: false }
	);
	window.addEventListener('blur', cancel);
	window.addEventListener('resize', cancel);
	document.addEventListener('visibilitychange', cancel);
	return {
		cancel,
		update: () => {
			if (
				sequence &&
				(!Session.Entity || !Renderer.rendering || (sequence.player && sequence.player !== Session.Entity))
			) {
				cancel();
			}
		}
	};
}
