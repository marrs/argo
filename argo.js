// NOTE:
// - What is currently referred to as a component may be better
//   described as a view context, as its sole purpose is to change
//   the context in which elements are rendered.  Here 'context'
//   refers to which sub-tree of the viewmodel the component has
//   access to.

function type(x) {
    return Object.prototype.toString.call(x).slice(8, -1);
}

function is_collection(x) {
    return [
        'Object'
      , 'Array',
      , 'Set'
    ].indexOf(type(x)) > -1;
}

function is_primitive(x) {
    return [
        'Boolean'
      , 'Number'
      , 'String'
      , 'Null'
      , 'Undefined'
    ].indexOf(type(x)) > -1;
}

function is_defined(x) {
    return undefined !== x;
}

function parent_addr(ky) {
  return ky.substring(0, ky.lastIndexOf('.'));
}

/*
function can_matcher_return_ml(matcher) {
    for (var output of Object.values(matcher.argo_meta.options)) {
        if (Array.isArray(output)) {
            return true;
        }
        if (is_named_fn(output, 'matcher')) {
            if (can_matcher_return_ml(output)) {
                return true;
            }
        }
    }
    return Array.isArray(matcher.argo_meta.dflt);
}
*/

function Render_Context(args) {
    Object.assign(this, {
        component: null,
        context: [],
        bindings: {},
        state: read_interface({}),
        delta: read_interface({}),
        ml_stack: new Stack(),
        post_render: [],
    }, args);
    this.$ = {
        get: this.delta.get,
        exists: this.delta.exists,
        query: this.delta.query,
        value: (prop, alt_val) => {
            var val = this.delta.get(this.addr(prop)) || alt_val;
            function embedder(el) {
                return val;
            };
            embedder.argo_name = 'embedder';
            return embedder;
        },
        match: (x, y, z) => {
            var prop_to_test = '', map, dflt;
            switch (type(x)) {
                case 'String': {
                    prop_to_test = x;
                    map = y[x];
                    dflt = z;
                } break;
                case 'Object': {
                    map = x;
                    dflt = y;
                } break;
                default: {
                    throw new Error("1st arg must be an object or a string");
                }
            }
            var matcher = el => {
                // Adds bindings for all possible branches and then returns the
                // binding and prop that matched the current delta so that render_ml
                // knows what to render and attach.

                var prop_addr, matching_binding, matching_prop, result, binding;
                if (prop_to_test) {
                    // TODO: Matcher will match the prop to one of the cases provided in map.
                    matching_prop = Object.keys(map).indexOf(prop_to_test);
                    // TODO: Add bindings for all cases (inc. default).
                    if (matching_prop > -1) {
                        // TODO: Set matching_binding to matching binding.
                    } else {
                        // TODO: Set matching_binding to default binding.
                    }
                    // FIXME: Placeholder: Delete once implemented.
                    matching_binding = this.add_binding('null', dflt);
                } else {
                    // Match on the existance of first available prop
                    for (var prop in map) {
                        binding = this.add_binding(prop, map[prop]);
                        prop_addr = this.addr('', prop);
                        if (this.delta.exists(prop_addr)) {
                            if (!this.state.exists(prop_addr)) {
                                if (matching_prop) {
                                    console.warn(`Argo: Ignoring '${prop}'; already matched on '${matching_prop}'.`);
                                } else {
                                    matching_binding = binding;
                                    matching_prop = prop;
                                }
                            }
                        }
                    }
                    binding = this.add_binding('null', dflt);
                    if (!matching_binding) {
                        matching_binding = binding;
                    }
                }
                return matching_binding;
            };
            matcher.argo_name = 'matcher';
            matcher.argo_meta = {
                options: map,
                dflt,
            };
            return matcher;
        },
    };
}

Object.assign(Render_Context.prototype, {
    addr: function() {
        // Returns absolute address of provided prop(s) relative to current
        // context.  E.g, if current context is 'foo.bar', addr('baz') will
        // return 'foo.bar.baz'.
        //
        // Returns address of current context if no args are provided.

        if (arguments.length) {
            var args = Array.prototype.filter.call(arguments, x => x).join('.');
            var ctx = this.addr();
            return ctx? ctx + '.' + args : args;
        } else {
            return this.context.reduce((acc, part) => {
                return part? acc + '.' + part : acc;
            }, '');
        }
    },

    push_ml_from_component: function(component, context='', parent_node) {
        this.push({
            expr: component(this.$),
            context,
            parent_node,
        });
        if (this.ml_stack.frame.context) {
            this.context.push(context);
        }
        return this;
    },

    push_ml_from_binding: function(binding) {
        this.push({
            expr: binding.ml,
            binding,
            parent_node: binding.parent_node
        });
        return this;
    },

    push_ml: function(ml) {
        this.push({ expr: ml });
        return this;
    },

    push: function(obj) {
        if (!obj.parent_node) {
            if (!this.ml_stack.frame) {
                throw new Error("A parent node must be provided for rendering");
            }
            obj.parent_node = this.ml_stack.frame.parent_node;
        }
        this.ml_stack.push(obj);
        return this;
    },

    pop: function() {
        var old_frame = this.ml_stack.pop();
        if (old_frame) {

            if (old_frame.context) {
                this.context.pop();
            }

            if (old_frame.binding) {
                old_frame.binding.is_rendered = true;
                old_frame.binding.is_attached = true;
            }
        }
        return old_frame;
    },

    bind_attr: function(node, ky, vl) {
        this.bindings[this.addr(ky)] = {
            node,
            fn: refresh_attr,
        };
        refresh_attr(node, ky, vl);
    },

    bind_node: function(node, ky, vl) {
        // TODO: Rewrite this.
        this.bindings[this.addr(ky)] = {
            node,
            fn: append_text_node,
        }
        append_text_node(node, ky, vl);
    },

    provide_bindings: function(prop = '') {
        return provide_branch(this.bindings, this.addr(prop));
    },

    add_binding: function(prop, ml) {
        var bindings = this.provide_bindings(prop);
        // Multiple components can bind to the same state addr.
        bindings.$bindings ??= {};
        bindings.$bindings[this.component_id] = new Binding({
            component: this.component,  // TODO: Delete me!
            component_id: this.component_id,  // TODO: Delete me!
            context: this.context.slice(), // TODO: Consider refering to the delta part directly.
            nodes: [],
            ml,
            parent_node: this.ml_stack.frame.parent_node,
            is_rendered: false,
        });
        return bindings.$bindings[this.component_id];
    },
});

function Binding(args) {
    Object.assign(this, {
        nodes: [],
        is_rendered: false,
        is_attached: false,
        context: undefined,
        ml: undefined,
        parent_node: undefined,
    }, args);

    return this;
}

Object.assign(Binding.prototype, {
    attach_rendered_nodes: function() {
        if (!this.is_rendered) {
            console.warn("Trying to attach nodes before they are rendered.");
            return this;
        }

        if (this.is_attached) {
            console.warn("Nodes already attached.");
            return this;
        }

        this.nodes.forEach(node => {
            this.parent_node.appendChild(node);
        });
        this.is_attached = true;

        return this;
    },

    detach_nodes: function() {
        if (!this.is_attached) {
            console.warn("Nodes already detached.");
            return this;
        }

        this.nodes.forEach(node => {
            if (node.parentNode !== this.parent_node) {
                console.error(`Expected node ${node} to be attached to ${this.parent_node}.`);
            }
            this.parent_node.removeChild(node);
        });
        this.is_attached = false;

        return this;
    },
});


function dom_detach_alt_nodes(context, ky) {
    // Remove any nodes from DOM that don't belong to ky.
    Object.keys(context).filter(x => x !== ky).forEach(alt_ky => {
        var $bindings = context[alt_ky].$bindings;
        Object.values($bindings).forEach(binding => {
            binding.detach_nodes();
        });
    });
}

function refresh_attr(node, ky, vl) {
    if (type(vl) === 'Boolean') {
        if(true === vl) {
            node.setAttribute(ky, ky);
        }
    } else {
        node.setAttribute(ky, vl);
    }
}

function append_text_node(el, vl) {
    el.appendChild(document.createTextNode(vl));
}

function process_attrs(node, attrs, $) {
    Object.keys(attrs).forEach(ky => {
        var vl = attrs[ky];
        if (type(vl) === 'Function') {
            switch (vl.name) {
                case 'bind': {
                    $.bind_attr(node, ky, vl(), refresh_attr);
                } break;
                case 'match': {
                    $.bind_attr(node, ky, vl(), refresh_attr);
                } break;
                default: {
                    node.addEventListener(ky, vl);
                }
            }
        } else {
            refresh_attr(node, ky, vl);
        }
    });
}

function is_named_fn(fn, name) {
    return 'Function' === type(fn) && name === fn.argo_name
}

function provide_branch(tree, path) {
    var result = tree;
    if (path) {
        path.split('.').forEach(x => {
            result[x] ??= {};
            result = result[x];
        });
    }
    return result;
}

function Stack() {
    this.frame;

    this.push = (x) => {
        Stack.prototype.push.call(this, x);
        this.frame = this.at(-1);
        return this;
    };

    this.pop = () => {
        var frame = Stack.prototype.pop.call(this);
        this.frame = this.length? this.at(-1) : undefined;
        return frame;
    };

    return this;
}

Stack.prototype = Object.create(Array.prototype);

// Wherever $.match is called, we need to provide the engine
// with the rendering options that the dev provided so that
// they can be utilised later on during runtime.
//
// This is done with the super_state and dependency chain properties
// under a given binding.

function render_ml($) {

    var binding;
    var counter = 0;

    while ($.ml_stack.length) {
        var ml_frame = $.ml_stack.frame;
        var ml = ml_frame.expr;

        if (counter++ > 1000) {
            debugger;
        }


        if (ml_frame.is_rendered) {
            $.pop();
            continue;
        }

        // If `ml_frame.idx` is defined then we're iterating an array
        // of either ml elements or their content, depending on whether
        // `is_content` was defined on current stack frame.
        if (is_defined(ml_frame.idx)) {
            if (ml_frame.idx < ml.length) {
                $.push({
                    expr: ml[ml_frame.idx],
                    is_content: ml_frame.is_content
                });
                ++ml_frame.idx;
            } else {
                $.pop();
            }
            continue;
        }

        if (ml_frame.is_content) {
            switch (type(ml)) {
                case 'Function': {
                    switch (ml.name) {
                        case 'embedder': {
                            // TODO
                            //$.bind_node(node);
                        } break;
                        case 'match': {
                            // TODO
                        } break;
                    }
                } break;
                case 'Array': {
                    if (type(ml[0]) === 'Function') {
                        if (ml.length > 2) {
                            throw new Error("Too many args for component", first);
                        }
                        // Alter context if it's proivded.
                        if (ml[1]) {
                            $.context.push(ml[1]);
                        }
                        $.push_ml_from_component(ml[0], ml[1]);
                    } else {
                        ml_frame.is_content = false;
                    }
                    continue;
                } break;
                case 'String':
                case 'Boolean':
                case 'Number': {
                    append_text_node($.ml_stack.frame.parent_node, ml.toString());
                } break;
                case 'Undefined':
                case 'Null':
                    break;
                default: {
                    throw new Error(`ml token of Illegal type (${type(ml)})`);
                }
            }
            $.pop();
            continue;
        }

        // The top-level of an expression can be a matcher, so this has to be
        // handled first.  We must create the bindings for all possible branches
        // now, but we only render the expression that's required for current
        // view model.
    
        if (is_named_fn(ml, 'matcher')) {
            binding = ml();
            ml = binding.ml;
            if (is_named_fn(ml, 'matcher')) {
                // TODO: Before we can support nested matchers,
                // we need a stack for the parent predicates
                // so that we can bind against the complete predicate
                // when we finally bind a node.
                throw new Error("Nested matchers are not yet supported");
            } else if (!Array.isArray(ml)) {
                throw new Error("jsonML must be an array.")
            }
            ml_frame.is_rendered = true;
            $.push_ml_from_binding(binding);
            continue;
        }

        // Beyond this point, ml must represent an element.
        if (!Array.isArray(ml)) {
            throw new Error("jsonML must represent an element.")
        }

        if (!ml.length) {
            $.pop();
            continue;
        }

        var first = ml[0];
        var second = ml[1];
        var rest = ml.slice(2);

        var element;
        var do_continue = false;

        switch (type(first)) {
            case 'Array': {
                console.log('ml array', ml);
                ml_frame.idx = 0;
                continue;
            } break;
            case 'String': {
                element = document.createElement(first);
                $.ml_stack.frame.parent_node.appendChild(element);
                $.ml_stack.frame.is_rendered = true;
                if (ml_frame.binding) {
                    // Attach node as soon as first element is rendered.
                    // That way the user sees a progressive load in the browser.
                    // The binding's `is_attached` and `is_rendered` flags won't be
                    // set until the binding has been fully rendered and ml_frame is
                    // popped from the stack.
                    ml_frame.binding.nodes.push(element);
                    ml_frame.binding.parent_node = $.ml_stack.frame.parent_node;
                }
            } break;
            case 'Function': {
                // TODO: Also need to check for matcher.
                // - In first position, matcher can return ml or a tag name.
                //   If it returns ml, this is an array of els and should be
                //   treated like above case 'Array'.
                if (rest.length) {
                    throw new Error("Too many args for component", first);
                }
                $.ml_stack.frame.is_rendered = true;
                $.push_ml_from_component(first, second);
                continue;
            };
            default: {
                console.log(type(first), first);
                throw new Error("Illegal element in first position");
            }
        }

        if (second) {
            if (type(second) === 'Object') {
                process_attrs(element, second, $);
            } else {
                rest.unshift(second);
            }
        }

        if (rest.length) {
            $.push({
                expr: rest,
                idx: 0,
                is_content: true,
                parent_node: element
            });
            continue;
        }
        $.pop();
    }
}

function lookup(obj, addr) {
    var result = obj;
    for (var prop of addr.split('.')) {
        if (result[prop]) {
            result = result[prop]
        } else {
            return;
        }
    }
    return result;
}

function read_interface(props) {
    return { exists, get, query };

    function exists(addr) {
        return is_defined(lookup(props, addr))? true : false;
    }

    function get(addr) {
        // Returns a value that has been copied from the props.  This is a
        // read-only query.  We must therefore not allow any references to
        // objects to be returned.  This means that arrays of objects will not
        // be returned so Argo must provide iterators for read-only access.
        
        if (['String', 'Number'].indexOf(type(addr)) < 0) {
            throw new Error("Only a single property may be queried. Use query for a set.");
        }
        var result = lookup(props, addr);
        if (is_primitive(result)) {
            return result;
        }
        throw new Error("Querying state for complex types is forbidden.");
    }

    function query(addr, sub_addr, result = {}, sup_addr) {
        // Like get but returns a map of values.
        // sub_addr and sup_addr are mutually exclusive.

        switch(type(addr)) {
            case 'Number':
            case 'String': {
                if (sub_addr) {
                    result[addr] = result[addr] || {};
                    return query(sub_addr, null, result, addr);
                } else if (!sup_addr) {
                    result[addr] = get(addr);
                } else {
                    result[sup_addr][addr] = get([sup_addr, addr].join('.'));
                }
            } break;
            case 'Array': {
                if (sub_addr) {
                    throw new Error("Sub queries can only be made against a single node.");
                }
                if (sup_addr) {
                    addr.forEach(x => {
                        result[sup_addr][x] = get([sup_addr, x].join('.'));
                    });
                } else {
                    addr.forEach(x => {
                        result[x] = get(x);
                    });
                }
            } break;
            default: {
                throw new Error("Invalid argument; expected string, number, or array of strings/numbers.");
            }
        }
        return result;
    }
}

function argo(root_component, root_element) {
    var traps = {};
    var is_rendering = false;
    var bindings = {};
    var state;

    return {
        init(props) {
            // Rendering the UI for the first time.
            // - Render components and add to DOM.
            // - Add any mutable DOM nodes to bindings.
            // - Updates will be handled separately.

            if (is_rendering) {
                throw new Error("Argo: Already rendering. Did you trigger a render event while rendering a component?");
            }
            is_rendering = true;
            if (state) {
                console.warn("Argo: Components already rendered.");
            }

            var render_context = new Render_Context({
                state: read_interface({}),
                delta: read_interface(props),
                bindings,
                component_id: 0,
            });
            
            render_context.push_ml_from_component(root_component, '', root_element);
            render_ml(render_context);

            is_rendering = false;
            state = props;
            console.group('initialised');
                console.log('state', state);
                console.log('bindings', bindings);
            console.groupEnd('initialised');
        },

        update(delta, context = [], parent_node) {
            // UI has already been rendered.
            // - Iterate through bindings and update their values depending on
            //   rules that have been established during init.
            // - Additions will require re-rendering of superordinate components.
            //   - These can be found under super_state.
            console.group('updating');
                console.log('state', state);
                console.log('delta', delta);
                console.log('bindings', bindings);
            console.groupEnd('updating');

            parent_node ??= root_element;

            var render_context = new Render_Context({
                state: read_interface(state),
                delta: read_interface(delta),
                context,
                component: root_component,
                bindings,
            });

            var cxt_bindings = render_context.provide_bindings('');

            // TODO:
            // - As written, this only works at top-level of bindings.
            // - We need a smart way to un/bind nested nodes.
            //   - If a node is being detached from the DOM, there is no
            //     need to drill further into its bindings.
            //   - If a node is being attached or updated, we need to drill
            //     into its bindings.
            for (var ky in delta) {
                var element = root_element;
                var nodes = [], post_render = [];
                var sub_bindings = cxt_bindings[ky];
                console.log('updating key', ky, sub_bindings);
                if (is_defined(delta[ky])) {
                    Object.values(sub_bindings.$bindings).forEach(binding => {
                        if (is_defined(state[ky])) {
                            // TODO:
                            // - Modify node if it is already rendered
                            console.log('nodes to update', binding.nodes);
                        } else if (binding.is_rendered) {
                            binding.attach_rendered_nodes();
                            // TODO: Update bindings.
                        } else {
                            render_context.component_id = binding.component_id;
                            console.log('updating binding', binding, 'against context', render_context);
                            render_context.push_ml_from_binding(binding);
                            render_ml(render_context);
                        }
                    });
                    dom_detach_alt_nodes(cxt_bindings, ky);
                } else if (is_defined(state[ky])) {
                    dom_detach_alt_nodes(cxt_bindings, null);
                    Object.values(cxt_bindings.null.$bindings).forEach(binding => {
                        if (binding.is_rendered) {
                            binding.attach_rendered_nodes();
                        } else {
                            render_context.component_id = binding.component_id;
                            render_context.push_ml_from_binding(binding);
                            render_ml(render_context);
                        }
                    });
                }

                nodes.forEach(node => {
                    this.update(delta[ky], context.slice().push(ky), node);
                });
            }
            apply_delta(state, delta);
        },

        bind(bindings) {
            // TODO: This will be called on page load to provide
            // bindings to components that were pre-rendered
            // on the server.
        },
    }

    function apply_delta(state, delta) {
        for (var key in delta) {
            if (is_primitive(delta[key])) {
                state[key] = delta[key];
            } else {
                return apply_delta(state[key], delta[key]);
            }
        }
    }
}

if (window.mocha) {
    window.render_ml = render_ml;
}

window.argo = argo;
export default argo;
