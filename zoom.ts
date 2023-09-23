/*!
	VanillaScope 1.0.0
	license: MIT
*/

const ZOOM_IMAGE_CLASS = 'zoomImg'

interface ZoomOptions {
	url: false
	callback: false
	target: false
	duration: 120
	on: 'mouseover' | 'grab' | 'click' | 'toggle'
	/** enables a touch fallback */
	touch: true, 
	onZoomIn: undefined,
	onZoomOut: undefined,
	magnify: 1
}

export const ZOOM_DEFAULT_OPTIONS = {
	url: false,
	callback: false,
	target: false,
	duration: 120,
	on: 'mouseover',
	touch: true,
	onZoomIn: undefined,
	onZoomOut: undefined,
	magnify: 1
} as const

function offset(el) {
	box = el.getBoundingClientRect();
	docElem = document.documentElement;
	return {
		top: box.top + window.pageYOffset - docElem.clientTop,
		left: box.left + window.pageXOffset - docElem.clientLeft
	};
}

function fadeTo(
	element: HTMLElement,
	duration: EffectTiming.duration,
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
function createZoom(target, source, img, magnify) {
	let targetHeight
	let targetWidth
	let sourceHeight
	let sourceWidth
	let xRatio
	let yRatio
	let offset
	const position = getComputedStyle($target)[position]

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
		maxHeight: 'none'
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

			offset = offset(source);
		},
		move(e) {
			let left = e.pageX - offset.left;
			let top = e.pageY - offset.top;
			
			left = Math.max(Math.min(left, sourceWidth), 0);
			top = Math.max(Math.min(top, sourceHeight), 0);

			img.style.left = (left * -xRatio) + 'px';
			img.style.top = (top * -yRatio) + 'px';
		}
	};
}

// source will provide zoom location info (thumbnail)
function zoomImage(source, options = {} ) {
	const settings = Object.assign({}, ZOOM_DEFAULT_OPTIONS, options)
	// target will display the zoomed image
	const target = settings.target || source
	const img = document.createElement('img')
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

	source.addEventListener('destroy', (event) =>  {
		const {position, overflow} = event.target.style // or just target.style??
		$source.off(".zoom"); // remove all eventListener
		target.style.position = position;
		target.style.overflow = overflow;
		img.onload = null;
		img.remove();
	}, { once: true });

	img.addEventListener('load', (event) => {
		const zoom = createZoom(target, source, img, settings.magnify);
	
		function start(e) {
			zoom.init();
			zoom.move(e);
	
			fadeTo(img, settings.duration, 1, settings.onZoomIn);
		}
	
		function stop() {
			fadeTo(img, settings.duration, 0, settings.onZoomOut);
		}
	
		// Mouse events
		if (settings.on === 'grab') {
			source.addEventListener('mousedown', (e) => {
				if (e.which === 1) {
					document.addEventListener('mouseup', () => {
						stop();

						document.removeEventListener(mousemove, zoom.move);
					}, { once: true });

					start(e);

					document.addEventListener(mousemove, zoom.move);

					e.preventDefault();
				}
			});
		} else if (settings.on === 'click') {
			source.addEventListener('click', (e) => {
				if (clicked) {
					// bubble the event up to the document to trigger the unbind.
					return;
				}
				clicked = true;
				start(e);
				document.addEventListener(mousemove, zoom.move);
				document.addEventListener('click', () => {
					stop();
					clicked = false;
					document.removeEventListener(mousemove, zoom.move);
				}, { once: true });
				return false;
			});
		} else if (settings.on === 'toggle') {
			source.addEventListener('click', (e) => {
				if (clicked) {
					stop();
				} else {
					start(e);
				}
				clicked = !clicked;
			});
			// TODO: remove 'click' listener
		} else if (settings.on === 'mouseover') {
			zoom.init(); // Preemptively call init because IE7 will fire the mousemove handler before the hover handler.
	
			source.addEventListener('mouseenter', start)
			source.addEventListener('mouseleave', stop)
			source.addEventListener(mousemove, zoom.move);
		}
	
		// Touch fallback
		if (settings.touch) {
			source.addEventListener('touchstart', (e) => {
				e.preventDefault();
				if (touched) {
					touched = false;
					stop();
				} else {
					touched = true;
					start(e.originalEvent.touches[0] || e.originalEvent.changedTouches[0]);
				}
			})
			source.addEventListener('touchmove', (e) => {
				e.preventDefault();
				zoom.move(e.originalEvent.touches[0] || e.originalEvent.changedTouches[0]);
			})
			source.addEventListener('touchend', (e) => {
				e.preventDefault();
				if (touched) {
					touched = false;
					stop();
				}
			});
		}
		
		if (typeof settings.callback === "function") {
			settings.callback.call(img);
		}
	})

	img.setAttribute('role', 'presentation');
	img.alt = '';
	img.src = settings.url;
}

export function zoom(selector, options) {
	return document.querySelectorAll(selector).map((image) => zoomImage(image, options))
}