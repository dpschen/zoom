/*!
	VanillaScope 1.0.0
	license: MIT
*/

const ZOOM_IMAGE_CLASS = 'zoomImg'

interface ZoomOptions {
	/** The url of the large photo to be displayed. If no url is provided, zoom uses the src of the first child IMG element inside the element it is assigned to. */
	url?: string
	/** A selector or DOM element that should be used as the parent container for the zoomed image. */
	target?: HTMLElement
	/** The fadeIn/fadeOut speed of the large image. */
	duration: number
	/** The type of event that triggers zooming. Choose from mouseover, grab, click, or toggle. */
	on: 'mouseover' | 'grab' | 'click' | 'toggle'
	/** Enables interaction via touch events. */
	touch: boolean, 
	/** This value is multiplied against the full size of the zoomed image. The default value is 1, meaning the zoomed image should be at 100% of its natural width and height. */
	magnify: number
	/** A function to be called when the image has loaded. */
	callback?: (img: HTMLImageElement) => {}
	/** A function to be called when the image has zoomed in. */
	onZoomIn?: (img: HTMLImageElement) => {}
	/** A function to be called when the image has zoomed out. */
	onZoomOut?: (img: HTMLImageElement) => {}
}

interface Offset {
	top: number
	left: number
}

export const ZOOM_DEFAULT_OPTIONS: ZoomOptions = {
	duration: 120,
	on: 'mouseover',
	touch: true,
	magnify: 1
} as const

function getOffset(el: HTMLElement): Offset {
	const box = el.getBoundingClientRect();
	const docElem = document.documentElement;
	return {
		top: box.top + window.scrollY - docElem.clientTop,
		left: box.left + window.scrollX - docElem.clientLeft
	};
}

function fadeTo(
	element: HTMLElement,
	duration: EffectTiming["duration"],
	opacity: number,
	callback?: () => {}
) {
	if (getComputedStyle(element)['display'] === 'none') {
		element.style.display = ''
	}

	const animation = element.animate({
	  opacity,
	}, {
	  duration: duration,
	  easing: "linear",
	  iterations: 1,
	  fill: "both"
	})
	.onfinish = function() {
	  if (opacity === 0) {
		element.style.display = "none";
	  }
	  if (callback) {
		callback();
	  }
	}

	return animation
}

// Core Zoom Logic, independent of event listeners.
function createZoom(
	target: HTMLElement,
	source: HTMLElement,
	img: HTMLImageElement,
	magnify: number
) {
	let targetHeight: number
	let targetWidth: number
	let sourceHeight: number
	let sourceWidth: number
	let xRatio: number
	let yRatio: number
	let offset: Offset
	const {position} = getComputedStyle(target)

	// The parent element needs positioning so that the zoomed element can be correctly positioned within.
	target.style.position = ['absolute', 'fixed'].includes(position) ? position : 'relative';
	target.style.overflow = 'hidden';

	img.style.width = '';
	img.style.height = '';

	img.classList.add(ZOOM_IMAGE_CLASS)
	Object.assign(img.style, {
		position: 'absolute',
		top: 0,
		left: 0,
		opacity: 0,
		width: img.width * magnify,
		height: img.height * magnify,
		border: 'none',
		maxWidth: 'none',
		maxHeight: 'none',
		transform: 'translate3d(0,0,0)'
	})

	target.append(img);

	return {
		init() {
			targetWidth = target.offsetWidth;
			targetHeight = target.offsetHeight;

			if (source === target) {
				sourceWidth = targetWidth;
				sourceHeight = targetHeight;
			} else {
				sourceWidth = source.offsetWidth;
				sourceHeight = source.offsetHeight;
			}

			xRatio = (img.width - targetWidth) / sourceWidth;
			yRatio = (img.height - targetHeight) / sourceHeight;

			offset = getOffset(source);
		},
		move(touch: Touch | MouseEvent) {
			let left = touch.pageX - offset.left;
			let top = touch.pageY - offset.top;
			
			left = Math.max(Math.min(left, sourceWidth), 0);
			top = Math.max(Math.min(top, sourceHeight), 0);

			img.style.left = (left * -xRatio) + 'px';
			img.style.top = (top * -yRatio) + 'px';
		}
	};
}

// source will provide zoom location info (thumbnail)
function zoomImage(source: HTMLImageElement, options: Partial<ZoomOptions> = {} ) {
	const settings: ZoomOptions = Object.assign({}, ZOOM_DEFAULT_OPTIONS, options)
	// target will display the zoomed image
	const target = settings.target || source
	const img =
		source.querySelector<HTMLImageElement>(ZOOM_IMAGE_CLASS) ||
		document.createElement('img')
	const mousemove = 'mousemove'

	let clicked = false
	let touched = false

	// If a url wasn't specified, look for an image element.
	if (!settings.url) {
		const srcElement = source.querySelector('img');
		if (srcElement) {
			settings.url = srcElement.getAttribute('data-src') || srcElement.currentSrc || srcElement.src;
		}
		if (!settings.url) {
			return;
		}
	}

	function destroy() {
		const {position, overflow} = event.target.style // or just target.style??
		$source.off(".zoom"); // remove all eventListener
		target.style.position = position;
		target.style.overflow = overflow;
		img.onload = null;
		img.remove();
	}
	// { once: true }

	img.addEventListener('load', (event) => {
		const zoom = createZoom(target, source, img, settings.magnify);
	
		function start(event: MouseEvent | Touch) {
			zoom.init();
			zoom.move(event);
	
			fadeTo(
				img,
				settings.duration,
				1,
				() => typeof settings.onZoomIn === "function" && settings.onZoomIn(img)
			);
		}
	
		function stop() {
			fadeTo(
				img,
				settings.duration,
				0,
				() => typeof settings.onZoomOut === "function" && settings.onZoomOut(img)
			);
		}
	
		// Mouse events
		if (settings.on === 'grab') {
			source.addEventListener('mousedown', (event) => {
				if (event.button === 0) {
					document.addEventListener('mouseup', () => {
						stop();

						document.removeEventListener(mousemove, zoom.move);
					}, { once: true });

					start(event);

					document.addEventListener(mousemove, zoom.move);

					event.preventDefault();
				}
			});
		} else if (settings.on === 'click') {
			source.addEventListener('click', (event) => {
				if (clicked) {
					// bubble the event up to the document to trigger the unbind.
					return;
				}
				clicked = true;
				start(event);
				document.addEventListener(mousemove, zoom.move);
				document.addEventListener('click', () => {
					stop();
					clicked = false;
					document.removeEventListener(mousemove, zoom.move);
				}, { once: true });
				event.preventDefault();
				event.stopPropagation();
			});
		} else if (settings.on === 'toggle') {
			source.addEventListener('click', (event) => {
				if (clicked) {
					stop();
					document.removeEventListener(mousemove, zoom.move);
				} else {
					start(event);
					document.addEventListener(mousemove, zoom.move);
				}
				clicked = !clicked;
			});
			// TODO: remove 'click' listener
		} else if (settings.on === 'toggle-drag') {
			var dragging = false;
			$(source).on('click.zoom',
				function (e) {
					if (dragging) {
						dragging = false;
						$(document).off(mousemove, zoom.move);
					} else if (clicked) {
						stop();
						clicked = false;
					} else {
						start(e);
						dragging = true	
						clicked = true;
						$(document).on(mousemove, zoom.move);
					}
				}
			);
		} else if (settings.on === 'mouseover') {
			// Preemptively call init because IE7 will fire the mousemove handler before the hover handler.
			// zoom.init();
	
			// source.addEventListener('mouseenter', start)
			source.addEventListener('mouseover', start)
			source.addEventListener('mouseleave', stop)
			source.addEventListener(mousemove, zoom.move);
		}
	
		// Touch fallback
		if (settings.touch) {
			source.addEventListener('touchstart', (event) => {
				// TODO: makes sense?
				if (settings.on === "click" || settings.on === "toggle") return;
				event.preventDefault();
				if (touched) {
					touched = false;
					stop();
				} else {
					touched = true;
					start(event.touches[0] || event.changedTouches[0]);
				}
			})
			source.addEventListener('touchmove', (event) => {
				// TODO: makes sense?
				if (!touched && !clicked) return;
				event.preventDefault();
				zoom.move(event.touches[0] || event.changedTouches[0]);
			})
			source.addEventListener('touchend', (event) => {
				event.preventDefault();
				if (touched) {
					touched = false;
					stop();
				}
			});
		}
		
		if (typeof settings.callback === "function") {
			settings.callback(img);
		}
	})

	img.setAttribute('role', 'presentation');
	img.alt = '';
	img.src = settings.url;
}

export function zoom(selector: string, options: ZoomOptions) {
	const elements = Array.from(document.querySelectorAll<HTMLImageElement>(selector))
	return elements.map((image) => zoomImage(image, options))
}