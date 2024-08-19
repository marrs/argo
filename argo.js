function type(x) {
    return Object.prototype.toString.call(x);
}

function ml_to_nodes(ml) {
    if (!Array.isArray(ml)) {
        throw new Error("jsonML must be an array.")
    }

    if (!ml.length) {
        return [];
    }

    var nodes = [];

    var first = ml[0];
    var second = ml[1];
    var rest = ml.slice(2);

    function process_attrs(node, attrs) {
        Object.keys(attrs).forEach(ky => {
            if (type(attrs[ky]) === '[object Function]') {
                node.addEventListener(ky, attrs[ky]);
            } else {
                node.setAttribute(ky, attrs[ky]);
            }
        });
    }

    switch (type(first)) {
        case '[object Array]': {
            nodes = ml_to_nodes(first);
        } break;
        case '[object String]': {
            var el = document.createElement(first);
            if (type(second) === '[object Object]') {
                process_attrs(el, second);
            }
            nodes.push(el);

        } break;
        case '[object Function]': {
            var component = first(fire);
            if (type(component.render) !== '[object Function]') {
                throw new Error("Render function not provided.");
            }
            nodes = ml_to_nodes(first.render(second));
        } break;
        case '[object Object]': {
            if (type(first.render) !== '[object Function]') {
                throw new Error("Render function not provided.");
            }
            nodes = ml_to_nodes(first.render(second));
            if (rest.length) {
                throw new Error("Too many args for component", first);
            }
        } return nodes;
        default: {
            throw new Error("Illegal element in first position");
        }
    }

    if (second) {
        if (type(second) === '[object Object]') {
            process_attrs(nodes[nodes.length -1], second);
        } else {
            rest.unshift(second);
        }
    }

    if (rest.length) {
        rest.forEach((item, idx) => {
            switch (type(item)) {
                case '[object Array]': {
                    ml_to_nodes(item).forEach(node => {
                        if (type(first) === '[object Array]') {
                            nodes.push(node);
                        } else {
                            nodes[0].append(node);
                        }
                    });
                } break;
                case '[object String]':
                case '[object Boolean]':
                case '[object Number]': {
                    nodes[0].append(rest[idx].toString());
                } break;
                default: {
                    throw new Error("Illegal type in position " + (nodes.length + idx));
                }
            }
        });
    }
    console.log('nodes', nodes);
    return nodes;
}

function argo(Component, el) {
    var traps = {};

    function fire(evt, payload) {
        var handlers = traps[evt];
        if (!handlers) {
            console.warn("Event [", evt, "] not handled by Argo.");
        } else {
            handlers.forEach((handler) => {
                handler(payload);
            });
        }
    }

    return {
        render(props) {
            var children = Array.prototype.slice.call(el.children);
            children.forEach(child => {
                el.removeChild(child);
            });
            children = undefined;
            var jsonml = Component(fire).render(props);
            el.append.apply(el, ml_to_nodes(jsonml));
        },
        on(evt, handler) {
            var handlers = traps[evt] = traps[evt] || []
            handlers.push(handler);
        },
        fire
    }
}

if (window.mocha) {
    window.ml_to_nodes = ml_to_nodes;
}

window.argo = argo;
