function type(x) {
    return Object.prototype.toString.call(x);
}

function render_nodes(Component, props, fire) {
    var component = Component(fire);
    var ml = component.render(props);
    return ml_to_nodes(ml, fire);
}

function process_attrs(node, attrs) {
    Object.keys(attrs).forEach(ky => {
        if (type(attrs[ky]) === '[object Function]') {
            node.addEventListener(ky, attrs[ky]);
        } else {
            node.setAttribute(ky, attrs[ky]);
        }
    });
}

function ml_to_nodes(ml, fire) {
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
            nodes = ml_to_nodes(component.render(second));
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
                    if (type(item[0]) === '[object Function]') {
                        if (item.length > 2) {
                            throw new Error("Too many args for component", first);
                        }
                        var _nodes = render_nodes(item[0], item[1], fire);
                    } else {
                        var _nodes = ml_to_nodes(item, fire);
                    }
                    _nodes.forEach(node => {
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
            el.append.apply(el, render_nodes(Component, props, fire));
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
