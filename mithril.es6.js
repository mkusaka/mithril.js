/* global Promise */

((global, factory) => // eslint-disable-line
{
    /* eslint-disable no-undef */
    const m = factory(global);
    /*	Set dependencies when no window for isomorphic compatibility */
    if (typeof window === "undefined") {
		m.deps({
			document: typeof document !== "undefined" ? document : {},
			location: typeof location !== "undefined" ? location : {},
			clearTimeout,
			setTimeout
		});
	}
    if (typeof module === "object" && module != null && module.exports) {
		module.exports = m;
	} else if (typeof define === "function" && define.amd) {
		define(() => m);
	} else {
		global.m = m;
	}
    /* eslint-enable no-undef */
})(typeof window !== "undefined" ? window : this, function factory(
	global,
	undefined
) // eslint-disable-line
{
    m.version = () => "v0.2.8";

    const hasOwn = {}.hasOwnProperty;
    const type = {}.toString;

    function isFunction(object) {
		return typeof object === "function";
	}

    function isObject(object) {
		return type.call(object) === "[object Object]";
	}

    function isString(object) {
		return type.call(object) === "[object String]";
	}

    const isArray =
		Array.isArray ||
		(object => type.call(object) === "[object Array]");

    function noop() {}

    const voidElements = {
		AREA: 1,
		BASE: 1,
		BR: 1,
		COL: 1,
		COMMAND: 1,
		EMBED: 1,
		HR: 1,
		IMG: 1,
		INPUT: 1,
		KEYGEN: 1,
		LINK: 1,
		META: 1,
		PARAM: 1,
		SOURCE: 1,
		TRACK: 1,
		WBR: 1
	};

    // caching commonly used variables
    let $document;

    let $location;
    let $requestAnimationFrame;
    let $cancelAnimationFrame;

    // self invoking function needed because of the way mocks work
    function initialize(mock) {
		$document = mock.document;
		$location = mock.location;
		$cancelAnimationFrame = mock.cancelAnimationFrame || mock.clearTimeout;
		$requestAnimationFrame = mock.requestAnimationFrame || mock.setTimeout;
	}

    // testing API
    m.deps = mock => {
		initialize((global = mock || window));
		return global;
	};

    m.deps.factory = m.factory = factory;

    m.deps(global);

    /**
	 * @typedef {String} Tag
	 * A string that looks like -> div.classname#id[param=one][param2=two]
	 * Which describes a DOM node
	 */

    function parseTagAttrs(cell, tag) {
		const classes = [];
		/* eslint-disable max-len */
		const parser = /(?:(^|#|\.)([^#\.\[\]]+))|(\[(.+?)(?:\s*=\s*("|'|)((?:\\["'\]]|.)*?)\5)?\])/g;
		/* eslint-enable max-len */
		let match;

		while ((match = parser.exec(tag))) {
			if (match[1] === "" && match[2]) {
				cell.tag = match[2];
			} else if (match[1] === "#") {
				cell.attrs.id = match[2];
			} else if (match[1] === ".") {
				classes.push(match[2]);
			} else if (match[3].charAt(0) === "[") {
				// #1195
				let attrValue = match[6];
				if (attrValue) attrValue = attrValue.replace(/\\(["'])/g, "$1");
				if (match[4] === "class") classes.push(attrValue);
				else cell.attrs[match[4]] = attrValue || true;
			}
		}

		return classes;
	}

    function getVirtualChildren(args, hasAttrs) {
		const children = hasAttrs ? args.slice(1) : args;

		if (children.length === 1 && isArray(children[0])) {
			return children[0];
		} else {
			return children;
		}
	}

    function assignAttrs(target, attrs, classes) {
		const classAttr = "class" in attrs ? "class" : "className";

		for (const attrName in attrs) {
			if (hasOwn.call(attrs, attrName)) {
				if (
					attrName === classAttr &&
					attrs[attrName] != null &&
					attrs[attrName] !== ""
				) {
					classes.push(attrs[attrName]);
					// create key in correct iteration order
					target[attrName] = "";
				} else {
					target[attrName] = attrs[attrName];
				}
			}
		}

		if (classes.length) target[classAttr] = classes.join(" ");
	}

    /**
	 *
	 * @param {Tag} The DOM node tag
	 * @param {Object=[]} optional key-value pairs to be mapped to DOM attrs
	 * @param {...mNode=[]} Zero or more Mithril child nodes. Can be an array,
	 *                      or splat (optional)
	 */
    class m {
        constructor(tag, pairs) {
            const args = [];

            for (let i = 1, length = arguments.length; i < length; i++) {
                args[i - 1] = arguments[i];
            }

            if (tag && isFunction(tag.view)) return parameterize(tag, args);

            if (!isString(tag)) {
                throw new Error(
                    "selector in m(selector, attrs, children) should " +
                        "be a string"
                );
            }

            const hasAttrs =
                pairs != null &&
                isObject(pairs) &&
                !("tag" in pairs || "view" in pairs || "subtree" in pairs);

            const attrs = hasAttrs ? pairs : {};
            const cell = {
                tag: "div",
                attrs: {},
                children: getVirtualChildren(args, hasAttrs)
            };

            assignAttrs(cell.attrs, attrs, parseTagAttrs(cell, tag));
            return cell;
        }

        static component(component) {
            const args = new Array(arguments.length - 1);

            for (let i = 1; i < arguments.length; i++) {
                args[i - 1] = arguments[i];
            }

            return parameterize(component, args);
        }

        static route(root, arg1, arg2, {attrs}) {
            // eslint-disable-line
            // m.rout
            if (arguments.length === 0) return currentRoute;
            // m.route(el, defaultRoute, routes)
            if (arguments.length === 3 && isString(arg1)) {
                redirect = source => {
                    const path = (currentRoute = normalizeRoute(source));
                    if (!routeByValue(root, arg2, path)) {
                        if (isDefaultRoute) {
                            throw new Error(
                                "Ensure the default route matches " +
                                    "one of the routes defined in m.route"
                            );
                        }

                        isDefaultRoute = true;
                        m.route(arg1, true);
                        isDefaultRoute = false;
                    }
                };

                const listener =
                    m.route.mode === "hash" ? "onhashchange" : "onpopstate";

                global[listener] = () => {
                    let path = $location[m.route.mode];
                    if (m.route.mode === "pathname") path += $location.search;
                    if (currentRoute !== normalizeRoute(path)) redirect(path);
                };

                computePreRedrawHook = setScroll;
                global[listener]();

                return;
            }

            // config: m.route
            if (root.addEventListener || root.attachEvent) {
                const base = m.route.mode !== "pathname" ? $location.pathname : "";
                root.href = base + modes[m.route.mode] + attrs.href;
                if (root.addEventListener) {
                    root.removeEventListener("click", routeUnobtrusive);
                    root.addEventListener("click", routeUnobtrusive);
                } else {
                    root.detachEvent("onclick", routeUnobtrusive);
                    root.attachEvent("onclick", routeUnobtrusive);
                }

                return;
            }
            // m.route(route, params, shouldReplaceHistoryEntry)
            if (isString(root)) {
                previousRoute = currentRoute;
                currentRoute = root;

                const args = arg1 || {};
                const queryIndex = currentRoute.indexOf("?");
                let params;

                if (queryIndex > -1) {
                    params = parseQueryString(currentRoute.slice(queryIndex + 1));
                } else {
                    params = {};
                }

                for (const i in args) {
                    if (hasOwn.call(args, i)) {
                        params[i] = args[i];
                    }
                }

                const querystring = buildQueryString(params);
                let currentPath;

                if (queryIndex > -1) {
                    currentPath = currentRoute.slice(0, queryIndex);
                } else {
                    currentPath = currentRoute;
                }

                if (querystring) {
                    currentRoute =
                        currentPath +
                        (!currentPath.includes("?") ? "?" : "&") +
                        querystring;
                }

                const replaceHistory =
                    (arguments.length === 3 ? arg2 : arg1) === true ||
                    previousRoute === currentRoute;

                if (global.history.pushState) {
                    const method = replaceHistory ? "replaceState" : "pushState";
                    computePreRedrawHook = setScroll;
                    computePostRedrawHook = () => {
                        try {
                            global.history[method](
                                null,
                                $document.title,
                                modes[m.route.mode] + currentRoute
                            );
                        } catch (err) {
                            // In the event of a pushState or replaceState failure,
                            // fallback to a standard redirect. This is specifically
                            // to address a Safari security error when attempting to
                            // call pushState more than 100 times.
                            $location[m.route.mode] = currentRoute;
                        }
                    };
                    redirect(modes[m.route.mode] + currentRoute);
                } else {
                    $location[m.route.mode] = currentRoute;
                    redirect(modes[m.route.mode] + currentRoute);
                }

                previousRoute = null;
            }
        }
    }

    function forEach(list, f) {
		for (let i = 0; i < list.length && !f(list[i], i++); ) {
			// function called in condition
		}
	}

    function forKeys(list, f) {
		forEach(list, (attrs, i) => (attrs = attrs && attrs.attrs) &&
        attrs.key != null &&
        f(attrs, i));
	}
    // This function was causing deopts in Chrome.
    function dataToString(data) {
		// data.toString() might throw or return null if data is the return
		// value of Console.log in some versions of Firefox (behavior depends on
		// version)
		try {
			if (
				typeof data !== "boolean" &&
				data != null &&
				data.toString() != null
			)
				return data;
		} catch (e) {
			// silently ignore errors
		}
		return "";
	}

    // This function was causing deopts in Chrome.
    function injectTextNode(parentElement, first, index, data) {
		try {
			insertNode(parentElement, first, index);
			first.nodeValue = data;
		} catch (e) {
			// IE erroneously throws error when appending an empty text node
			// after a null
		}
	}

    function flatten(list) {
		// recursively flatten array
		for (let i = 0; i < list.length; i++) {
			if (isArray(list[i])) {
				list = list.concat.apply([], list);
				// check current index again and flatten until there are no more
				// nested arrays at that index
				i--;
			}
		}
		return list;
	}

    function insertNode(parentElement, node, index) {
		parentElement.insertBefore(
			node,
			parentElement.childNodes[index] || null
		);
	}

    const DELETION = 1;
    const INSERTION = 2;
    const MOVE = 3;

    function handleKeysDiffer(data, existing, cached, parentElement) {
		forKeys(data, (key, i) => {
			existing[(key = key.key)] = existing[key]
				? {
						action: MOVE,
						index: i,
						from: existing[key].index,
						element:
							cached.nodes[existing[key].index] ||
							$document.createElement("div")
				  }
				: { action: INSERTION, index: i };
		});

		const actions = [];
		for (const prop in existing) {
			if (hasOwn.call(existing, prop)) {
				actions.push(existing[prop]);
			}
		}

		const changes = actions.sort(sortChanges);
		const newCached = new Array(cached.length);

		newCached.nodes = cached.nodes.slice();

		forEach(changes, change => {
			const index = change.index;
			if (change.action === DELETION) {
				clear(cached[index].nodes, cached[index]);
				newCached.splice(index, 1);
			}
			if (change.action === INSERTION) {
				const dummy = $document.createElement("div");
				dummy.key = data[index].attrs.key;
				insertNode(parentElement, dummy, index);
				newCached.splice(index, 0, {
					attrs: { key: data[index].attrs.key },
					nodes: [dummy]
				});
				newCached.nodes[index] = dummy;
			}

			if (change.action === MOVE) {
				const changeElement = change.element;
				const maybeChanged = parentElement.childNodes[index];
				if (maybeChanged !== changeElement && changeElement !== null) {
					parentElement.insertBefore(
						changeElement,
						maybeChanged || null
					);
				}
				newCached[index] = cached[change.from];
				newCached.nodes[index] = changeElement;
			}
		});

		return newCached;
	}

    function diffKeys(data, cached, existing, parentElement) {
		let keysDiffer = data.length !== cached.length;

		if (!keysDiffer) {
			forKeys(data, ({key}, i) => {
				const cachedCell = cached[i];
				return keysDiffer =
					cachedCell &&
					cachedCell.attrs &&
					cachedCell.attrs.key !== key;
			});
		}

		if (keysDiffer) {
			return handleKeysDiffer(data, existing, cached, parentElement);
		} else {
			return cached;
		}
	}

    function diffArray(data, cached, nodes) {
		// diff the array itself

		// update the list of DOM nodes by collecting the nodes from each item
		forEach(data, (_, i) => {
			if (cached[i] != null) nodes.push(...cached[i].nodes);
		});
		// remove items from the end of the array if the new array is shorter
		// than the old one. if errors ever happen here, the issue is most
		// likely a bug in the construction of the `cached` data structure
		// somewhere earlier in the program
		forEach(cached.nodes, (node, i) => {
			if (node.parentNode != null && !nodes.includes(node)) {
				clear([node], [cached[i]]);
			}
		});

		if (data.length < cached.length) cached.length = data.length;
		cached.nodes = nodes;
	}

    function buildArrayKeys(data) {
		let guid = 0;
		forKeys(data, () => {
			forEach(data, attrs => {
				if ((attrs = attrs && attrs.attrs) && attrs.key == null) {
					attrs.key = `__mithril__${guid++}`;
				}
			});
			return 1;
		});
	}

    function isDifferentEnough({tag, attrs}, {tag, attrs, configContext}, dataAttrKeys) {
		if (tag !== tag) return true;

		if (
			dataAttrKeys.sort().join() !==
			Object.keys(attrs)
				.sort()
				.join()
		) {
			return true;
		}

		if (attrs.id !== attrs.id) {
			return true;
		}

		if (attrs.key !== attrs.key) {
			return true;
		}

		if (m.redraw.strategy() === "all") {
			return !configContext || configContext.retain !== true;
		}

		if (m.redraw.strategy() === "diff") {
			return configContext && configContext.retain === false;
		}

		return false;
	}

    function maybeRecreateObject(data, cached, dataAttrKeys) {
		// if an element is different enough from the one in cache, recreate it
		if (isDifferentEnough(data, cached, dataAttrKeys)) {
			if (cached.nodes.length) clear(cached.nodes);

			if (
				cached.configContext &&
				isFunction(cached.configContext.onunload)
			) {
				cached.configContext.onunload();
			}

			if (cached.controllers) {
				forEach(cached.controllers, controller => {
					if (controller.onunload) {
						controller.onunload({ preventDefault: noop });
					}
				});
			}
		}
	}

    function getObjectNamespace({attrs, tag}, namespace) {
		if (attrs.xmlns) return attrs.xmlns;
		if (tag === "svg") return "http://www.w3.org/2000/svg";
		if (tag === "math") return "http://www.w3.org/1998/Math/MathML";
		return namespace;
	}

    let pendingRequests = 0;
    m.startComputation = () => {
		pendingRequests++;
	};
    m.endComputation = () => {
		if (pendingRequests > 1) {
			pendingRequests--;
		} else {
			pendingRequests = 0;
			m.redraw();
		}
	};

    function unloadCachedControllers(cached, views, controllers) {
		if (controllers.length) {
			cached.views = views;
			cached.controllers = controllers;
			forEach(controllers, controller => {
				if (controller.onunload && controller.onunload.$old) {
					controller.onunload = controller.onunload.$old;
				}

				if (pendingRequests && controller.onunload) {
					const onunload = controller.onunload;
					controller.onunload = () => {};
					controller.onunload.$old = onunload;
				}
			});
		}
	}

    function scheduleConfigsToBeCalled(configs, data, node, isNew, cached) {
		// schedule configs to be called. They are called after `build` finishes
		// running
		if (isFunction(data.attrs.config)) {
			const context = (cached.configContext = cached.configContext || {});

			// bind
			configs.push(() => data.attrs.config.call(
                data,
                node,
                !isNew,
                context,
                cached
            ));
		}
	}

    // 更新用のnode作成器
    function buildUpdatedNode(
        cached,
        {tag, attrs, children},
        editable,
        hasKeys,
        namespace,
        views,
        configs,
        controllers
    ) {
		const node = cached.nodes[0];

		if (hasKeys) {
			setAttributes(node, tag, attrs, cached.attrs, namespace);
		}

		// 子ノードに追加
		cached.children = build(
			node,
			tag,
			undefined,
			undefined,
			children,
			cached.children,
			false,
			0,
			attrs.contenteditable ? node : editable,
			namespace,
			configs
		);

		cached.nodes.intact = true;

		// controllerが存在すればviewsと共にキャシュする
		if (controllers.length) {
			cached.views = views;
			cached.controllers = controllers;
		}

		return node;
	}

    function handleNonexistentNodes(data, parentElement, index) {
		let nodes;
		if (data.$trusted) {
			nodes = injectHTML(parentElement, index, data);
		} else {
			nodes = [$document.createTextNode(data)];
			if (!(parentElement.nodeName in voidElements)) {
				insertNode(parentElement, nodes[0], index);
			}
		}

		let cached;

		if (
			typeof data === "string" ||
			typeof data === "number" ||
			typeof data === "boolean"
		) {
			cached = new data.constructor(data);
		} else {
			cached = data;
		}

		cached.nodes = nodes;
		return cached;
	}

    function reattachNodes(
		data,
		cached,
		parentElement,
		editable,
		index,
		parentTag
	) {
		let nodes = cached.nodes;
		if (
			!editable ||
			editable !== $document.activeElement ||
			data !== cached
		) {
			if (data.$trusted) {
				clear(nodes, cached);
				nodes = injectHTML(parentElement, index, data);
			} else if (parentTag === "textarea") {
				// <textarea> uses `value` instead of `nodeValue`.
				parentElement.value = data;
			} else if (editable) {
				// contenteditable nodes use `innerHTML` instead of `nodeValue`.
				editable.innerHTML = data;
				nodes = [].slice.call(editable.childNodes);
			} else {
				// was a trusted string
				if (
					nodes[0].nodeType === 1 ||
					nodes.length > 1 ||
					(nodes[0].nodeValue.trim && !nodes[0].nodeValue.trim())
				) {
					clear(cached.nodes, cached);
					nodes = [$document.createTextNode(data)];
				}

				injectTextNode(parentElement, nodes[0], index, data);
			}
		}
		cached = new data.constructor(data);
		cached.nodes = nodes;
		cached.$trusted = data.$trusted;
		return cached;
	}

    function handleTextNode(
		cached,
		data,
		index,
		parentElement,
		shouldReattach,
		editable,
		parentTag
	) {
		if (!cached.nodes.length) {
			return handleNonexistentNodes(data, parentElement, index);
		} else if (cached.valueOf() !== data.valueOf() || shouldReattach) {
			return reattachNodes(
				data,
				cached,
				parentElement,
				editable,
				index,
				parentTag
			);
		} else {
			return (cached.nodes.intact = true), cached;
		}
	}

    function getSubArrayCount(item) {
		if (item.$trusted) {
			// fix offset of next element if item was a trusted string w/ more
			// than one html element
			return item.nodes.length;
		} else if (isArray(item)) {
			return item.length;
		}
		return 1;
	}

    function buildArray(
		data,
		cached,
		parentElement,
		index,
		parentTag,
		shouldReattach,
		editable,
		namespace,
		configs
	) {
		data = flatten(data);
		const nodes = [];
		let intact = cached.length === data.length;
		let subArrayCount = 0;

		// keys algorithm: sort elements without recreating them if keys are
		// present
		//
		// 1) create a map of all existing keys, and mark all for deletion
		// 2) add new keys to map and mark them for addition
		// 3) if key exists in new list, change action from deletion to a move
		// 4) for each key, handle its corresponding action as marked in
		//    previous steps

		const existing = {};
		let shouldMaintainIdentities = false;

		forKeys(cached, (attrs, i) => {
			shouldMaintainIdentities = true;
			existing[cached[i].attrs.key] = { action: DELETION, index: i };
		});

		buildArrayKeys(data);
		if (shouldMaintainIdentities) {
			cached = diffKeys(data, cached, existing, parentElement);
		}
		// end key algorithm

		let cacheCount = 0;
		// faster explicitly written
		for (let i = 0, len = data.length; i < len; i++) {
			// diff each item in the array
			const item = build(
				parentElement,
				parentTag,
				cached,
				index,
				data[i],
				cached[cacheCount],
				shouldReattach,
				index + subArrayCount || subArrayCount,
				editable,
				namespace,
				configs
			);

			if (item !== undefined) {
				intact = intact && item.nodes.intact;
				subArrayCount += getSubArrayCount(item);
				cached[cacheCount++] = item;
			}
		}

		if (!intact) diffArray(data, cached, nodes);
		return cached;
	}

    function makeCache(data, cached, index, parentIndex, parentCache) {
		if (cached != null) {
			if (type.call(cached) === type.call(data)) return cached;

			if (parentCache && parentCache.nodes) {
				const offset = index - parentIndex;
				const end = offset + (isArray(data) ? data : cached.nodes).length;
				clear(
					parentCache.nodes.slice(offset, end),
					parentCache.slice(offset, end)
				);
			} else if (cached.nodes) {
				clear(cached.nodes, cached);
			}
		}

		cached = new data.constructor();
		// if constructor creates a virtual dom element, use a blank object as
		// the base cached node instead of copying the virtual el (#277)
		if (cached.tag) cached = {};
		cached.nodes = [];
		return cached;
	}

    // たぶんここがnodeの実態作るところ
    function constructNode({attrs, tag}, namespace) {
		if (attrs.is) {
			if (namespace == null) {
				return $document.createElement(tag, attrs.is);
			} else {
				return $document.createElementNS(
					namespace,
					tag,
					attrs.is
				);
			}
		} else if (namespace == null) {
			return $document.createElement(tag);
		} else {
			return $document.createElementNS(namespace, tag);
		}
	}

    function constructAttrs({tag, attrs}, node, namespace, hasKeys) {
		if (hasKeys) {
			return setAttributes(node, tag, attrs, {}, namespace);
		} else {
			return attrs;
		}
	}

    function constructChildren({children, tag, attrs}, node, {children}, editable, namespace, configs) {
		if (children != null && children.length > 0) {
			return build(
				node,
				tag,
				undefined,
				undefined,
				children,
				children,
				true,
				0,
				attrs.contenteditable ? node : editable,
				namespace,
				configs
			);
		} else {
			return children;
		}
	}

    function reconstructCached({tag}, attrs, children, node, namespace, views, controllers) {
		const cached = {
			tag: tag,
			attrs,
			children,
			nodes: [node]
		};

		unloadCachedControllers(cached, views, controllers);

		if (cached.children && !cached.children.nodes) {
			cached.children.nodes = [];
		}

		return cached;
	}

    function getController(views, view, cachedControllers, controller) {
		let controllerIndex;

		if (m.redraw.strategy() === "diff" && views) {
			controllerIndex = views.indexOf(view);
		} else {
			controllerIndex = -1;
		}

		if (controllerIndex > -1) {
			return cachedControllers[controllerIndex];
		} else if (isFunction(controller)) {
			return new controller();
		} else {
			return {};
		}
	}

    let unloaders = [];

    function updateLists(views, controllers, view, controller) {
		if (
			controller.onunload != null &&
			!unloaders
				.map(({handler}) => handler).includes(controller.onunload)
		) {
			unloaders.push({
				controller,
				handler: controller.onunload
			});
		}

		views.push(view);
		controllers.push(controller);
	}

    let forcing = false;
    function checkView(
		data,
		view,
		cached,
		cachedControllers,
		controllers,
		views
	) {
		const controller = getController(
			cached.views,
			view,
			cachedControllers,
			data.controller
		);

		const key = data && data.attrs && data.attrs.key;

		if (
			pendingRequests === 0 ||
			forcing ||
			(cachedControllers && cachedControllers.includes(controller))
		) {
			data = data.view(controller);
		} else {
			data = { tag: "placeholder" };
		}

		if (data.subtree === "retain") return data;
		data.attrs = data.attrs || {};
		data.attrs.key = key;
		updateLists(views, controllers, view, controller);
		return data;
	}

    function markViews(data, cached, views, controllers) {
		const cachedControllers = cached && cached.controllers;

		while (data.view != null) {
			data = checkView(
				data,
				data.view.$original || data.view,
				cached,
				cachedControllers,
				controllers,
				views
			);
		}

		return data;
	}

    // node生成ロジック
    function buildObject( // eslint-disable-line max-statements
		data,
		cached,
		editable,
		parentElement,
		index,
		shouldReattach,
		namespace,
		configs
	) {
		const views = [];
		const controllers = [];

		data = markViews(data, cached, views, controllers);

		if (data.subtree === "retain") return cached;

		if (!data.tag && controllers.length) {
			throw new Error(
				"Component template must return a virtual " +
					"element, not an array, string, etc."
			);
		}

		data.attrs = data.attrs || {};
		cached.attrs = cached.attrs || {};

		const dataAttrKeys = Object.keys(data.attrs);
		const hasKeys = dataAttrKeys.length > ("key" in data.attrs ? 1 : 0);

		maybeRecreateObject(data, cached, dataAttrKeys);

		if (!isString(data.tag)) return;

		const isNew = cached.nodes.length === 0;

		namespace = getObjectNamespace(data, namespace);

		let node;
		// cached.nodesがなければnodeを作ってcacheする
		if (isNew) {
			node = constructNode(data, namespace);
			// set attributes first, then create children
			const attrs = constructAttrs(data, node, namespace, hasKeys);

			// add the node to its parent before attaching children to it
			insertNode(parentElement, node, index);

			const children = constructChildren(
				data,
				node,
				cached,
				editable,
				namespace,
				configs
			);

			cached = reconstructCached(
				data,
				attrs,
				children,
				node,
				namespace,
				views,
				controllers
			);
		} else {
			// 更新用のnode作成
			node = buildUpdatedNode(
				cached,
				data,
				editable,
				hasKeys,
				namespace,
				views,
				configs,
				controllers
			);
		}

		// edge case: setting value on <select> doesn't work before children
		// exist, so set it again after children have been created/updated
		if (data.tag === "select" && "value" in data.attrs) {
			setAttributes(
				node,
				data.tag,
				{ value: data.attrs.value },
				{},
				namespace
			);
		}

		// こうしんする必要があれば差分だけ適用
		if (!isNew && shouldReattach === true && node != null) {
			insertNode(parentElement, node, index);
		}

		// The configs are called after `build` finishes running
		scheduleConfigsToBeCalled(configs, data, node, isNew, cached);

		return cached;
	}

    // domの差分を検知してcache等々をアップデートするコア機能
    function build(
		parentElement,
		parentTag,
		parentCache,
		parentIndex,
		data,
		cached,
		shouldReattach,
		index,
		editable,
		namespace,
		configs
	) {
		/*
		 * `build` is a recursive function that manages creation/diffing/removal
		 * of DOM elements based on comparison between `data` and `cached` the
		 * diff algorithm can be summarized as this:
		 *
		 * 1 - compare `data` and `cached`
		 * 2 - if they are different, copy `data` to `cached` and update the DOM
		 *     based on what the difference is
		 * 3 - recursively apply this algorithm for every array and for the
		 *     children of every virtual element
		 *
		 * The `cached` data structure is essentially the same as the previous
		 * redraw's `data` data structure, with a few additions:
		 * - `cached` always has a property called `nodes`, which is a list of
		 *    DOM elements that correspond to the data represented by the
		 *    respective virtual element
		 * - in order to support attaching `nodes` as a property of `cached`,
		 *    `cached` is *always* a non-primitive object, i.e. if the data was
		 *    a string, then cached is a String instance. If data was `null` or
		 *    `undefined`, cached is `new String("")`
		 * - `cached also has a `configContext` property, which is the state
		 *    storage object exposed by config(element, isInitialized, context)
		 * - when `cached` is an Object, it represents a virtual element; when
		 *    it's an Array, it represents a list of elements; when it's a
		 *    String, Number or Boolean, it represents a text node
		 *
		 * `parentElement` is a DOM element used for W3C DOM API calls
		 * `parentTag` is only used for handling a corner case for textarea
		 * values
		 * `parentCache` is used to remove nodes in some multi-node cases
		 * `parentIndex` and `index` are used to figure out the offset of nodes.
		 * They're artifacts from before arrays started being flattened and are
		 * likely refactorable
		 * `data` and `cached` are, respectively, the new and old nodes being
		 * diffed
		 * `shouldReattach` is a flag indicating whether a parent node was
		 * recreated (if so, and if this node is reused, then this node must
		 * reattach itself to the new parent)
		 * `editable` is a flag that indicates whether an ancestor is
		 * contenteditable
		 * `namespace` indicates the closest HTML namespace as it cascades down
		 * from an ancestor
		 * `configs` is a list of config functions to run after the topmost
		 * `build` call finishes running
		 *
		 * there's logic that relies on the assumption that null and undefined
		 * data are equivalent to empty strings
		 * - this prevents lifecycle surprises from procedural helpers that mix
		 *   implicit and explicit return statements (e.g.
		 *   function foo() {if (cond) return m("div")}
		 * - it simplifies diffing code
		 */
		data = dataToString(data);
		if (data.subtree === "retain") return cached;
		cached = makeCache(data, cached, index, parentIndex, parentCache);

		if (isArray(data)) {
			return buildArray(
				data,
				cached,
				parentElement,
				index,
				parentTag,
				shouldReattach,
				editable,
				namespace,
				configs
			);
		} else if (data != null && isObject(data)) {
			return buildObject(
				data,
				cached,
				editable,
				parentElement,
				index,
				shouldReattach,
				namespace,
				configs
			);
		} else if (!isFunction(data)) {
			return handleTextNode(
				cached,
				data,
				index,
				parentElement,
				shouldReattach,
				editable,
				parentTag
			);
		} else {
			return cached;
		}
	}

    function sortChanges({action, index}, {action, index}) {
		return action - action || index - index;
	}

    function copyStyleAttrs(node, dataAttr, cachedAttr) {
		if (cachedAttr === dataAttr) {
			node.style = "";
			cachedAttr = {};
		}
		for (var rule in dataAttr) {
			if (hasOwn.call(dataAttr, rule)) {
				if (cachedAttr == null || cachedAttr[rule] !== dataAttr[rule]) {
					node.style[rule] = dataAttr[rule];
				}
			}
		}

		for (rule in cachedAttr) {
			if (hasOwn.call(cachedAttr, rule)) {
				if (!hasOwn.call(dataAttr, rule)) node.style[rule] = "";
			}
		}
	}

    const shouldUseSetAttribute = {
		list: 1,
		style: 1,
		form: 1,
		type: 1,
		width: 1,
		height: 1
	};

    function setSingleAttr(
		node,
		attrName,
		dataAttr,
		cachedAttr,
		tag,
		namespace
	) {
		if (attrName === "config" || attrName === "key") {
			// `config` isn't a real attribute, so ignore it
			return true;
		} else if (isFunction(dataAttr) && attrName.slice(0, 2) === "on") {
			// hook event handlers to the auto-redrawing system
			node[attrName] = autoredraw(dataAttr, node);
		} else if (
			attrName === "style" &&
			dataAttr != null &&
			isObject(dataAttr)
		) {
			// handle `style: {...}`
			copyStyleAttrs(node, dataAttr, cachedAttr);
		} else if (namespace != null) {
			// handle SVG
			if (attrName === "href") {
				node.setAttributeNS(
					"http://www.w3.org/1999/xlink",
					"href",
					dataAttr
				);
			} else {
				node.setAttribute(
					attrName === "className" ? "class" : attrName,
					dataAttr
				);
			}
		} else if (attrName in node && !shouldUseSetAttribute[attrName]) {
			// handle cases that are properties (but ignore cases where we
			// should use setAttribute instead)
			//
			// - list and form are typically used as strings, but are DOM
			//   element references in js
			//
			// - when using CSS selectors (e.g. `m("[style='']")`), style is
			//   used as a string, but it's an object in js
			//
			// #348 don't set the value if not needed - otherwise, cursor
			// placement breaks in Chrome
			// #1252 likewise when `contenteditable` is set on an element.
			try {
				if (
					(tag !== "input" && !node.isContentEditable) ||
					node[attrName] != dataAttr // eslint-disable-line eqeqeq
				) {
					node[attrName] = dataAttr;
				}
			} catch (e) {
				node.setAttribute(attrName, dataAttr);
			}
		} else {
			try {
				node.setAttribute(attrName, dataAttr);
			} catch (e) {
				// IE8 doesn't allow change input attributes and throws
				// an exception. Unfortunately it cannot be handled, because
				// error code is not informative.
			}
		}
	}

    function trySetAttr(
		node,
		attrName,
		dataAttr,
		cachedAttr,
		cachedAttrs,
		tag,
		namespace
	) {
		if (
			!(attrName in cachedAttrs) ||
			cachedAttr !== dataAttr ||
			typeof dataAttr === "object" ||
			$document.activeElement === node
		) {
			cachedAttrs[attrName] = dataAttr;
			try {
				return setSingleAttr(
					node,
					attrName,
					dataAttr,
					cachedAttr,
					tag,
					namespace
				);
			} catch (e) {
				// swallow IE's invalid argument errors to mimic HTML's
				// fallback-to-doing-nothing-on-invalid-attributes behavior
				if (!e.message.includes("Invalid argument")) throw e;
			}
		} else if (
			attrName === "value" &&
			tag === "input" &&
			/* eslint-disable eqeqeq */
			node.value != dataAttr
		) {
			// #348 dataAttr may not be a string,
			// so use loose comparison
			/* eslint-enable eqeqeq */
			node.value = dataAttr;
		}
	}

    function setAttributes(node, tag, dataAttrs, cachedAttrs, namespace) {
		for (const attrName in dataAttrs) {
			if (hasOwn.call(dataAttrs, attrName)) {
				if (
					trySetAttr(
						node,
						attrName,
						dataAttrs[attrName],
						cachedAttrs[attrName],
						cachedAttrs,
						tag,
						namespace
					)
				) {
					continue;
				}
			}
		}
		return cachedAttrs;
	}

    function clear(nodes, cached) {
		for (let i = nodes.length - 1; i > -1; i--) {
			if (nodes[i] && nodes[i].parentNode) {
				try {
					nodes[i].parentNode.removeChild(nodes[i]);
				} catch (e) {
					/* eslint-disable max-len */
					// ignore if this fails due to order of events (see
					// http://stackoverflow.com/questions/21926083/failed-to-execute-removechild-on-node)
					/* eslint-enable max-len */
				}
				cached = [].concat(cached);
				if (cached[i]) unload(cached[i]);
			}
		}
		// release memory if nodes is an array. This check should fail if nodes
		// is a NodeList (see loop above)
		if (nodes.length) {
			nodes.length = 0;
		}
	}

    function unload(cached) {
		if (cached.configContext && isFunction(cached.configContext.onunload)) {
			cached.configContext.onunload();
			cached.configContext.onunload = null;
		}
		if (cached.controllers) {
			forEach(cached.controllers, controller => {
				if (isFunction(controller.onunload)) {
					controller.onunload({ preventDefault: noop });
				}
			});
		}
		if (cached.children) {
			if (isArray(cached.children)) forEach(cached.children, unload);
			else if (cached.children.tag) unload(cached.children);
		}
	}

    function appendTextFragment(parentElement, data) {
		try {
			parentElement.appendChild(
				$document.createRange().createContextualFragment(data)
			);
		} catch (e) {
			parentElement.insertAdjacentHTML("beforeend", data);
			replaceScriptNodes(parentElement);
		}
	}

    // Replace script tags inside given DOM element with executable ones.
    // Will also check children recursively and replace any found script
    // tags in same manner.
    function replaceScriptNodes(node) {
		if (node.tagName === "SCRIPT") {
			node.parentNode.replaceChild(buildExecutableNode(node), node);
		} else {
			const children = node.childNodes;
			if (children && children.length) {
				for (let i = 0; i < children.length; i++) {
					replaceScriptNodes(children[i]);
				}
			}
		}

		return node;
	}

    // Replace script element with one whose contents are executable.
    function buildExecutableNode({attributes, innerHTML}) {
		const scriptEl = document.createElement("script");
		const attrs = attributes;

		for (let i = 0; i < attrs.length; i++) {
			scriptEl.setAttribute(attrs[i].name, attrs[i].value);
		}

		scriptEl.text = innerHTML;
		return scriptEl;
	}

    function injectHTML(parentElement, index, data) {
		const nextSibling = parentElement.childNodes[index];
		if (nextSibling) {
			const isElement = nextSibling.nodeType !== 1;
			const placeholder = $document.createElement("span");
			if (isElement) {
				parentElement.insertBefore(placeholder, nextSibling || null);
				placeholder.insertAdjacentHTML("beforebegin", data);
				parentElement.removeChild(placeholder);
			} else {
				nextSibling.insertAdjacentHTML("beforebegin", data);
			}
		} else {
			appendTextFragment(parentElement, data);
		}

		const nodes = [];

		while (parentElement.childNodes[index] !== nextSibling) {
			nodes.push(parentElement.childNodes[index]);
			index++;
		}

		return nodes;
	}

    function autoredraw(callback, object) {
		return (e = event) => {
            m.redraw.strategy("diff");
            m.startComputation();
            try {
				return callback.call(object, e);
			} finally {
				endFirstComputation();
			}
        };
	}

    let html;
    const documentNode = {
		appendChild(node) {
			if (html === undefined) html = $document.createElement("html");
			if (
				$document.documentElement &&
				$document.documentElement !== node
			) {
				$document.replaceChild(node, $document.documentElement);
			} else {
				$document.appendChild(node);
			}

			this.childNodes = $document.childNodes;
		},

		insertBefore(node) {
			this.appendChild(node);
		},

		childNodes: []
	};

    const nodeCache = [];
    const cellCache = {};

    m.render = (root, cell, forceRecreation) => {
		if (!root) {
			throw new Error(
				"Ensure the DOM element being passed to " +
					"m.route/m.mount/m.render is not undefined."
			);
		}
		const configs = [];
		const id = getCellCacheKey(root);
		const isDocumentRoot = root === $document;
		let node;

		if (isDocumentRoot || root === $document.documentElement) {
			node = documentNode;
		} else {
			node = root;
		}

		if (isDocumentRoot && cell.tag !== "html") {
			cell = { tag: "html", attrs: {}, children: cell };
		}

		if (cellCache[id] === undefined) clear(node.childNodes);
		if (forceRecreation === true) reset(root);

		cellCache[id] = build(
			node,
			null,
			undefined,
			undefined,
			cell,
			cellCache[id],
			false,
			0,
			null,
			undefined,
			configs
		);

		forEach(configs, config => {
			config();
		});
	};

    function getCellCacheKey(element) {
		const index = nodeCache.indexOf(element);
		return index < 0 ? nodeCache.push(element) - 1 : index;
	}

    m.trust = value => {
		value = new String(value); // eslint-disable-line no-new-wrappers
		value.$trusted = true;
		return value;
	};

    function gettersetter(store) {
		function prop(...args) {
			if (args.length) store = args[0];
			return store;
		}

		prop.toJSON = () => {
			if (store && isFunction(store.toJSON)) return store.toJSON();
			return store;
		};

		return prop;
	}

    m.prop = store => {
		if (
			((store != null && (isObject(store) || isFunction(store))) ||
				(typeof Promise !== "undefined" && store instanceof Promise)) &&
			isFunction(store.then)
		) {
			return propify(store);
		}

		return gettersetter(store);
	};

    const roots = [];
    const components = [];
    const controllers = [];
    let lastRedrawId = null;
    let lastRedrawCallTime = 0;
    let computePreRedrawHook = null;
    let computePostRedrawHook = null;
    let topComponent;
    const FRAME_BUDGET = 16; // 60 frames per second = 1 call per 16 ms

    function parameterize(component, args) {
		function controller() {
			/* eslint-disable no-invalid-this */
			return (component.controller || noop).apply(this, args) || this;
			/* eslint-enable no-invalid-this */
		}

		if (component.controller) {
			controller.prototype = component.controller.prototype;
		}

		function view(ctrl) {
			const currentArgs = [ctrl].concat(args);
			for (let i = 1; i < arguments.length; i++) {
				currentArgs.push(arguments[i]);
			}

			return component.view(...currentArgs);
		}

		view.$original = component.view;
		const output = { controller, view };
		if (args[0] && args[0].key != null) output.attrs = { key: args[0].key };
		return output;
	}

    let currentRoute;
    let previousRoute;

    function checkPrevented(component, root, index, isPrevented) {
		if (!isPrevented) {
			m.redraw.strategy("all");
			m.startComputation();
			roots[index] = root;
			let currentComponent;

			if (component) {
				currentComponent = topComponent = component;
			} else {
				currentComponent = topComponent = component = {
					controller: noop
				};
			}

			const controller = new (component.controller || noop)();

			// controllers may call m.mount recursively (via m.route redirects,
			// for example)
			// this conditional ensures only the last recursive m.mount call is
			// applied
			if (currentComponent === topComponent) {
				controllers[index] = controller;
				components[index] = component;
			}
			endFirstComputation();
			if (component === null) {
				removeRootElement(root, index);
			}
			return controllers[index];
		} else {
			if (component == null) {
				removeRootElement(root, index);
			}

			if (previousRoute) {
				currentRoute = previousRoute;
			}
		}
	}

    m.mount = m.module = (root, component) => {
		if (!root) {
			throw new Error(
				"Ensure the DOM element being passed to " +
					"m.route/m.mount/m.render is not undefined."
			);
		}

		let index = roots.indexOf(root);
		if (index < 0) index = roots.length;

		let isPrevented = false;
		const event = {
			preventDefault() {
				isPrevented = true;
				computePreRedrawHook = computePostRedrawHook = null;
			}
		};

		forEach(unloaders, ({handler, controller}) => {
			handler.call(controller, event);
			controller.onunload = null;
		});

		if (isPrevented) {
			forEach(unloaders, ({controller, handler}) => {
				controller.onunload = handler;
			});
		} else {
			unloaders = [];
		}

		if (controllers[index] && isFunction(controllers[index].onunload)) {
			controllers[index].onunload(event);
		}

		return checkPrevented(component, root, index, isPrevented);
	};

    function removeRootElement(root, index) {
		roots.splice(index, 1);
		controllers.splice(index, 1);
		components.splice(index, 1);
		reset(root);
		nodeCache.splice(getCellCacheKey(root), 1);
		unloaders = [];
	}

    let redrawing = false;
    m.redraw = force => {
		if (redrawing) return;
		redrawing = true;
		if (force) forcing = true;

		try {
			// lastRedrawId is a positive number if a second redraw is requested
			// before the next animation frame
			// lastRedrawId is null if it's the first redraw and not an event
			// handler
			if (lastRedrawId && !force) {
				// when setTimeout: only reschedule redraw if time between now
				// and previous redraw is bigger than a frame, otherwise keep
				// currently scheduled timeout
				// when rAF: always reschedule redraw
				if (
					$requestAnimationFrame === global.requestAnimationFrame ||
					new Date() - lastRedrawCallTime > FRAME_BUDGET
				) {
					if (lastRedrawId > 0) $cancelAnimationFrame(lastRedrawId);
					lastRedrawId = $requestAnimationFrame(redraw, FRAME_BUDGET);
				}
			} else {
				redraw();
				lastRedrawId = $requestAnimationFrame(() => {
					lastRedrawId = null;
				}, FRAME_BUDGET);
			}
		} finally {
			redrawing = forcing = false;
		}
	};

    m.redraw.strategy = m.prop();
    function redraw() {
		if (computePreRedrawHook) {
			computePreRedrawHook();
			computePreRedrawHook = null;
		}
		forEach(roots, (root, i) => {
			const component = components[i];
			if (controllers[i]) {
				const args = [controllers[i]];
				m.render(
					root,
					component.view ? component.view(controllers[i], args) : ""
				);
			}
		});
		// after rendering within a routed context, we need to scroll back to
		// the top, and fetch the document title for history.pushState
		if (computePostRedrawHook) {
			computePostRedrawHook();
			computePostRedrawHook = null;
		}
		lastRedrawId = null;
		lastRedrawCallTime = new Date();
		m.redraw.strategy("diff");
	}

    function endFirstComputation() {
		if (m.redraw.strategy() === "none") {
			pendingRequests--;
			m.redraw.strategy("diff");
		} else {
			m.endComputation();
		}
	}

    m.withAttr = (prop, withAttrCallback, callbackThis) => (function(e = window.event) {
        /* eslint-disable no-invalid-this */
        const currentTarget = e.currentTarget || this;
        const _this = callbackThis || this;
        /* eslint-enable no-invalid-this */
        const target =
            prop in currentTarget
                ? currentTarget[prop]
                : currentTarget.getAttribute(prop);
        withAttrCallback.call(_this, target);
    });

    // routing
    const modes = { pathname: "", hash: "#", search: "?" };
    let redirect = noop;
    let isDefaultRoute = false;
    let routeParams;

    m.route.param = key => {
		if (!routeParams) {
			throw new Error(
				"You must call m.route(element, defaultRoute, " +
					"routes) before calling m.route.param()"
			);
		}

		if (!key) {
			return routeParams;
		}

		return routeParams[key];
	};

    m.route.mode = "search";

    function normalizeRoute(route) {
		return route.slice(modes[m.route.mode].length);
	}

    function routeByValue(root, router, path) {
		routeParams = {};

		const queryStart = path.indexOf("?");
		if (queryStart !== -1) {
			routeParams = parseQueryString(
				path.substr(queryStart + 1, path.length)
			);
			path = path.substr(0, queryStart);
		}

		// Get all routes and check if there's
		// an exact match for the current path
		const keys = Object.keys(router);
		const index = keys.indexOf(path);

		if (index !== -1) {
			m.mount(root, router[keys[index]]);
			return true;
		}

		for (const route in router) {
			if (hasOwn.call(router, route)) {
				if (route === path) {
					m.mount(root, router[route]);
					return true;
				}

				const matcher = new RegExp(
					`^${route
    .replace(/:[^\/]+?\.{3}/g, "(.*?)")
    .replace(/:[^\/]+/g, "([^\\/]+)")}/?$`
				);

				if (matcher.test(path)) {
					/* eslint-disable no-loop-func */
					path.replace(matcher, function(...args) {
						const keys = route.match(/:[^\/]+/g) || [];
						const values = [].slice.call(args, 1, -2);
						forEach(keys, (key, i) => {
							routeParams[
								key.replace(/:|\./g, "")
							] = decodeURIComponent(values[i]);
						});
						m.mount(root, router[route]);
					});
					/* eslint-enable no-loop-func */
					return true;
				}
			}
		}
	}

    function routeUnobtrusive(e = event) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.which === 2) return;

        if (e.preventDefault) {
			e.preventDefault();
		} else {
			e.returnValue = false;
		}

        let currentTarget = e.currentTarget || e.srcElement;
        let args;

        if (m.route.mode === "pathname" && currentTarget.search) {
			args = parseQueryString(currentTarget.search.slice(1));
		} else {
			args = {};
		}

        while (currentTarget && !/a/i.test(currentTarget.nodeName)) {
			currentTarget = currentTarget.parentNode;
		}

        // clear pendingRequests because we want an immediate route change
        pendingRequests = 0;
        m.route(
			currentTarget[m.route.mode].slice(modes[m.route.mode].length),
			args
		);
    }

    function setScroll() {
		if (m.route.mode !== "hash" && $location.hash) {
			$location.hash = $location.hash;
		} else {
			global.scrollTo(0, 0);
		}
	}

    function buildQueryString(object, prefix) {
		const duplicates = {};
		const str = [];

		for (const prop in object) {
			if (hasOwn.call(object, prop)) {
				const key = prefix ? `${prefix}[${prop}]` : prop;
				const value = object[prop];

				if (value === null) {
					str.push(encodeURIComponent(key));
				} else if (isObject(value)) {
					str.push(buildQueryString(value, key));
				} else if (isArray(value)) {
					const keys = [];
					duplicates[key] = duplicates[key] || {};
					/* eslint-disable no-loop-func */
					forEach(value, item => {
						/* eslint-enable no-loop-func */
						if (!duplicates[key][item]) {
							duplicates[key][item] = true;
							keys.push(
								`${encodeURIComponent(key)}=${encodeURIComponent(item)}`
							);
						}
					});
					str.push(keys.join("&"));
				} else if (value !== undefined) {
					str.push(
						`${encodeURIComponent(key)}=${encodeURIComponent(value)}`
					);
				}
			}
		}

		return str.join("&");
	}

    function parseQueryString(str) {
		if (str === "" || str == null) return {};
		if (str.charAt(0) === "?") str = str.slice(1);

		const pairs = str.split("&");
		const params = {};

		forEach(pairs, string => {
			const pair = string.split("=");
			const key = decodeURIComponent(pair[0]);
			const value = pair.length === 2 ? decodeURIComponent(pair[1]) : null;
			if (params[key] != null) {
				if (!isArray(params[key])) params[key] = [params[key]];
				params[key].push(value);
			} else params[key] = value;
		});

		return params;
	}

    m.route.buildQueryString = buildQueryString;
    m.route.parseQueryString = parseQueryString;

    function reset(root) {
		const cacheKey = getCellCacheKey(root);
		clear(root.childNodes, cellCache[cacheKey]);
		cellCache[cacheKey] = undefined;
	}

    m.deferred = () => {
		const deferred = new Deferred();
		deferred.promise = propify(deferred.promise);
		return deferred;
	};

    function propify(promise, initialValue) {
		const prop = m.prop(initialValue);
		promise.then(prop);
		prop.then = (resolve, reject) => propify(promise.then(resolve, reject), initialValue);

		prop["catch"] = prop.then.bind(null, null);
		return prop;
	}
    // Promiz.mithril.js | Zolmeister | MIT
    // a modified version of Promiz.js, which does not conform to Promises/A+
    // for two reasons:
    //
    // 1) `then` callbacks are called synchronously (because setTimeout is too
    //    slow, and the setImmediate polyfill is too big
    //
    // 2) throwing subclasses of Error cause the error to be bubbled up instead
    //    of triggering rejection (because the spec does not account for the
    //    important use case of default browser error handling, i.e. message w/
    //    line number)

    const RESOLVING = 1;
    const REJECTING = 2;
    const RESOLVED = 3;
    const REJECTED = 4;

    function Deferred(onSuccess, onFailure) {
		const self = this;
		let state = 0;
		let promiseValue = 0;
		const next = [];

		self.promise = {};

		self.resolve = value => {
			if (!state) {
				promiseValue = value;
				state = RESOLVING;

				fire();
			}

			return self;
		};

		self.reject = value => {
			if (!state) {
				promiseValue = value;
				state = REJECTING;

				fire();
			}

			return self;
		};

		self.promise.then = (onSuccess, onFailure) => {
			const deferred = new Deferred(onSuccess, onFailure);

			if (state === RESOLVED) {
				deferred.resolve(promiseValue);
			} else if (state === REJECTED) {
				deferred.reject(promiseValue);
			} else {
				next.push(deferred);
			}

			return deferred.promise;
		};

		function finish(type) {
			state = type || REJECTED;
			next.map(deferred => {
				if (state === RESOLVED) {
					deferred.resolve(promiseValue);
				} else {
					deferred.reject(promiseValue);
				}
			});
		}

		function thennable(then, success, failure, notThennable) {
			if (
				((promiseValue != null && isObject(promiseValue)) ||
					isFunction(promiseValue)) &&
				isFunction(then)
			) {
				try {
					// count protects against abuse calls from spec checker
					let count = 0;
					then.call(
						promiseValue,
						value => {
							if (count++) return;
							promiseValue = value;
							success();
						},
						value => {
							if (count++) return;
							promiseValue = value;
							failure();
						}
					);
				} catch (e) {
					m.deferred.onerror(e);
					promiseValue = e;
					failure();
				}
			} else {
				notThennable();
			}
		}

		function fire() {
			// check if it's a thenable
			let then;
			try {
				then = promiseValue && promiseValue.then;
			} catch (e) {
				m.deferred.onerror(e);
				promiseValue = e;
				state = REJECTING;
				return fire();
			}

			if (state === REJECTING) {
				m.deferred.onerror(promiseValue);
			}

			thennable(
				then,
				() => {
					state = RESOLVING;
					fire();
				},
				() => {
					state = REJECTING;
					fire();
				},
				() => {
					try {
						if (state === RESOLVING && isFunction(onSuccess)) {
							promiseValue = onSuccess(promiseValue);
						} else if (
							state === REJECTING &&
							isFunction(onFailure)
						) {
							promiseValue = onFailure(promiseValue);
							state = RESOLVING;
						}
					} catch (e) {
						m.deferred.onerror(e);
						promiseValue = e;
						return finish();
					}

					if (promiseValue === self) {
						promiseValue = TypeError();
						finish();
					} else {
						thennable(
							then,
							() => {
								finish(RESOLVED);
							},
							finish,
							() => {
								finish(state === RESOLVING && RESOLVED);
							}
						);
					}
				}
			);
		}
	}

    m.deferred.onerror = e => {
		if (
			type.call(e) === "[object Error]" &&
			!/ Error/.test(e.constructor.toString())
		) {
			pendingRequests = 0;
			throw e;
		}
	};

    m.sync = args => {
		const deferred = m.deferred();
		let outstanding = args.length;
		const results = [];
		let method = "resolve";

		function synchronizer(pos, resolved) {
			return value => {
				results[pos] = value;
				if (!resolved) method = "reject";
				if (--outstanding === 0) {
					deferred.promise(results);
					deferred[method](results);
				}
				return value;
			};
		}

		if (args.length > 0) {
			forEach(args, (arg, i) => {
				arg.then(synchronizer(i, true), synchronizer(i, false));
			});
		} else {
			deferred.resolve([]);
		}

		return deferred.promise;
	};

    function identity(value) {
		return value;
	}

    function handleJsonp(options) {
		const callbackKey =
			options.callbackName ||
			`mithril_callback_${new Date().getTime()}_${Math.round(Math.random() * 1e16).toString(36)}`;

		const script = $document.createElement("script");

		global[callbackKey] = resp => {
			script.parentNode.removeChild(script);
			options.onload({
				type: "load",
				target: {
					responseText: resp
				}
			});
			global[callbackKey] = undefined;
		};

		script.onerror = () => {
			script.parentNode.removeChild(script);

			options.onerror({
				type: "error",
				target: {
					status: 500,
					responseText: JSON.stringify({
						error: "Error making jsonp request"
					})
				}
			});
			global[callbackKey] = undefined;

			return false;
		};

		script.onload = () => false;

		script.src =
			`${options.url +
(options.url.indexOf("?") > 0 ? "&" : "?") +
(options.callbackKey ? options.callbackKey : "callback")}=${callbackKey}&${buildQueryString(options.data || {})}`;

		$document.body.appendChild(script);
	}

    function createXhr(options) {
		let xhr = new global.XMLHttpRequest();
		xhr.open(
			options.method,
			options.url,
			true,
			options.user,
			options.password
		);

		xhr.onreadystatechange = () => {
			if (xhr.readyState === 4) {
				if (xhr.status >= 200 && xhr.status < 300) {
					options.onload({ type: "load", target: xhr });
				} else {
					options.onerror({ type: "error", target: xhr });
				}
			}
		};

		if (
			options.serialize === JSON.stringify &&
			options.data &&
			options.method !== "GET"
		) {
			xhr.setRequestHeader(
				"Content-Type",
				"application/json; charset=utf-8"
			);
		}

		if (options.deserialize === JSON.parse) {
			xhr.setRequestHeader("Accept", "application/json, text/*");
		}

		if (isObject(options.headers)) {
			for (const header in options.headers) {
				if (hasOwn.call(options.headers, header)) {
					xhr.setRequestHeader(header, options.headers[header]);
				}
			}
		}

		if (isFunction(options.config)) {
			const maybeXhr = options.config(xhr, options);
			if (maybeXhr != null) xhr = maybeXhr;
		}

		const data =
			options.method === "GET" || !options.data ? "" : options.data;

		if (data && !isString(data) && data.constructor !== global.FormData) {
			throw new Error(
				"Request data should be either be a string or " +
					"FormData. Check the `serialize` option in `m.request`"
			);
		}

		xhr.send(data);
		return xhr;
	}

    function ajax(options) {
		if (options.dataType && options.dataType.toLowerCase() === "jsonp") {
			return handleJsonp(options);
		} else {
			return createXhr(options);
		}
	}

    function bindData(options, data, serialize) {
		if (options.method === "GET" && options.dataType !== "jsonp") {
			const prefix = !options.url.includes("?") ? "?" : "&";
			const querystring = buildQueryString(data);
			options.url += querystring ? prefix + querystring : "";
		} else {
			options.data = serialize(data);
		}
	}

    function parameterizeUrl(url, data) {
		if (data) {
			url = url.replace(/:[a-z]\w+/gi, token => {
				const key = token.slice(1);
				const value = data[key] || token;
				delete data[key];
				return value;
			});
		}
		return url;
	}

    m.request = options => {
        if (options.background !== true) m.startComputation();
        const deferred = new Deferred();
        const isJSONP =
			options.dataType && options.dataType.toLowerCase() === "jsonp";

        let serialize;
        let deserialize;
        let extract;

        if (isJSONP) {
			serialize = options.serialize = deserialize = options.deserialize = identity;

			extract = ({responseText}) => responseText;
		} else {
			serialize = options.serialize = options.serialize || JSON.stringify;

			deserialize = options.deserialize =
				options.deserialize || JSON.parse;
			extract =
				options.extract ||
				(({responseText}) => {
					if (responseText.length || deserialize !== JSON.parse) {
						return responseText;
					} else {
						return null;
					}
				});
		}

        options.method = (options.method || "GET").toUpperCase();
        options.url = parameterizeUrl(options.url, options.data);
        bindData(options, options.data, serialize);
        options.onload = options.onerror = ev => {
			try {
				ev = ev || event;
				let response = deserialize(extract(ev.target, options));
				if (ev.type === "load") {
					if (options.unwrapSuccess) {
						response = options.unwrapSuccess(response, ev.target);
					}

					if (isArray(response) && options.type) {
						forEach(response, (res, i) => {
							response[i] = new options.type(res);
						});
					} else if (options.type) {
						response = new options.type(response);
					}

					deferred.resolve(response);
				} else {
					if (options.unwrapError) {
						response = options.unwrapError(response, ev.target);
					}

					deferred.reject(response);
				}
			} catch (e) {
				deferred.reject(e);
				m.deferred.onerror(e);
			} finally {
				if (options.background !== true) m.endComputation();
			}
		};

        ajax(options);
        deferred.promise = propify(deferred.promise, options.initialValue);
        return deferred.promise;
    };

    return m;
}); // eslint-disable-line
