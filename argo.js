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

function Render_Context(args) {
    Object.assign(this, {
        component: null,
        context: [],
        bindings: {},
        state: read_interface({}),
        delta: read_interface({}),
        dom_node_stack: [],
        parents: [],
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
            var ctx = '', map, dflt;
            switch (type(x)) {
                case 'String': {
                    ctx = x;
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
                this.context.push(ctx);
                var prop_addr, match, result, binding;
                for (var prop in map) {
                    binding = this.add_binding(prop, map[prop]);
                    prop_addr = this.addr(ctx, prop);
                    if (this.delta.exists(prop_addr)) {
                        if (!this.state.exists(prop_addr)) {
                            match = binding;
                            break;
                        }
                    }
                }
                binding = this.add_binding('null', dflt);
                if (!match) {
                    match = binding;
                }
                result = render_ml(match.ml, this, match);
                match.is_rendered = true;
                this.context.pop(ctx);
                return result;
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
            fn: refresh_content,
        }
        refresh_content(node, ky, vl);
    },

    provide_bindings: function(prop = '') {
        return provide_branch(this.bindings, this.addr(prop));
    },

    add_binding: function(prop, ml) {
        var bindings = this.provide_bindings(prop);
        // Multiple components can bind to the same state addr.
        bindings.$bindings ??= {};
        bindings.$bindings[this.component_id] = {
            component: this.component,  // TODO: Delete me!
            component_id: this.component_id,  // TODO: Delete me!
            context: this.context,
            nodes: [],
            ml,
            parent_node: this.dom_node_stack.at(-1),
            is_rendered: false,
        };
        return bindings.$bindings[this.component_id];
    },
});

function dom_detach_alt_nodes(context, ky) {
    // Remove any nodes from DOM that don't belong to ky.
    Object.keys(context).filter(x => x !== ky).forEach(_ky => {
        var $bindings = context[_ky].$bindings;
        console.log('bindings to remove for ky', _ky, $bindings);
        for (var prop in $bindings) {
            for (var node of $bindings[prop].nodes) {
                if (node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            }
        }
    });
}

function render_component(component, $, required_binding) {
    if ($.component) {
        // XXX: This may not be required.  We can get these data from
        // $.bindings.  All we need is $.context and $.component_id.
        $.parents.push({
            component: $.component,
            component_id: $.component_id,
            dom_node: $.parent_node,
        });
    }
    $.component = component;
    ++$.component_id
    var ml = component($.$);
    var { post_render } = render_ml(ml, $, required_binding);
    if (type(component.postRender) === 'Function') {
        post_render.push([component.postRender, $.dom_node_stack.at(-1)]);
    }

    // XXX: This may not be required. See above
    if ($.parents.length) {
        var parent = $.parents.pop();
        $.component = parent.component;
        $.parent_node = parent.dom_node;
    }
    return {
        post_render,
    };
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

function refresh_content(el, vl) {
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

function get_branch(tree, path) {
    var result = tree;
    path.split('.').forEach(x => {
        if (!result[x]) {
            throw new Error(`Object does not exist at address [${path}]`);
        }
        result = result[x];
    });
    return result;
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

// Wherever $.match is called, we need to provide the engine
// with the rendering options that the dev provided so that
// they can be utilised later on during runtime.
//
// This is done with the super_state and dependency chain properties
// under a given binding.

function render_ml(ml, $, required_binding) {
    console.log('rendering ml', ml, required_binding);

    // When a matcher is returned at this level, it means the developer
    // has provided a number of rendering options for sub-components based
    // on the state of the component's context.
    //
    // One of these branches will be rendered on the first run.  Others may
    // be rendered in the future, depending on how the state changes.
    //
    // We therefore bind all branching options now so that they can be called
    // when they are required in the future.

    if (is_named_fn(ml, 'matcher')) {
        return ml();
    }

    if (!Array.isArray(ml)) {
        throw new Error("jsonML must be an array.")
    }

    if (!ml.length) {
        return {
            post_render: [],
        };
    }

    var post_render = [];

    var is_ml_element_list = true;

    for (var item of ml) {
        if (is_named_fn(item, 'matcher')) {
            if (!can_matcher_return_ml(item)) {
                is_ml_element_list = false;
                break;
            }
        } else if (!Array.isArray(item)) {
            is_ml_element_list = false;
            break;
        }
    }

    if (is_ml_element_list) {
        ml.forEach(el => {
            var result = render_ml(el, $, required_binding);
            post_render = post_render.concat(result.post_render);
        });
        return { post_render };
    }

    var first = ml[0];
    var second = ml[1];
    var rest = ml.slice(2);

    var element;

    switch (type(first)) {
      case 'Array': {
          console.log('omg', ml);
          /*
          ml.forEach(el => {
              var result = render_ml(el, $, required_binding);
              post_render = post_render.concat(result.post_render);
          });
          */
          //render_ml(first, $, required_binding);
        } break;
        case 'String': {
            element = document.createElement(first);
            $.dom_node_stack.at(-1).appendChild(element);
            if (required_binding) {
                required_binding.nodes.push(element);
                // TODO: Delete? is this right?  We already have a parent_node by now?
                //required_binding.parent_node = $.dom_node_stack.at(-1);
            }
            $.dom_node_stack.push(element);
        } break;
        case 'Function': {
            // TODO: Also need to check for matcher.
            // - In first position, matcher can return ml or a tag name.
            //   If it returns ml, this is an array of els and should be
            //   treated like above case 'Array'.
            second && $.ascend(second);
            var {post_render} = render_component(first, $, required_binding);
        } return {
            post_render
        };
        default: {
            console.log(type(first), first);
            throw new Error("Illegal element in first position");
        }
    }

    if (second) {
        if (type(second) === 'Object') {
            process_attrs($.dom_node_stack.at(-1), second, $);
        } else {
            rest.unshift(second);
        }
    }

    if (rest.length) {
        rest.forEach((item, idx) => {
            switch (type(item)) {
                case 'Function': {
                    switch (item.name) {
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
                    if (type(item[0]) === 'Function') {
                        if (item.length > 2) {
                            throw new Error("Too many args for component", first);
                        }
                        // Alter context if it's proivded.
                        if (item[1]) {
                            $.ascend(item[1]);
                        }
                        var result = render_component(item[0], $);
                        post_render = post_render.concat(result.post_render);
                    } else {
                        var result = render_ml(item, $);
                        post_render = post_render.concat(result.post_render);
                    }
                } break;
                case 'String':
                case 'Boolean':
                case 'Number': {
                    refresh_content($.dom_node_stack.at(-1), item.toString());
                } break;
                case 'Undefined':
                case 'Null':
                    break;
                default: {
                    throw new Error("Illegal type in position " + idx);
                }
            }
        });
    }
    if (element) {
        $.dom_node_stack.pop();
    }
    return { post_render };
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

            // component_id is only set once on initialisation.  After that, it
            // is incremented at the beginning of render_component.  The thinking
            // is that this function is only ever called when the component is
            // rendered, which should only happen once for the lifetime of the
            // page, so assigning an ID on render seems like a safe bet.
            //
            // If this turns out not to be the case, we may have a problem with
            // identifying which components map to their super_state.

            var render_context = new Render_Context({
                state: read_interface({}),
                delta: read_interface(props),
                bindings,
                component_id: 0,
                dom_node_stack: [root_element],
            });
            var { post_render } = render_component(root_component, render_context);
            post_render.forEach(hook => {
                // TODO:
                hook[0](hook[1]);
            })
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
                dom_node_stack: [parent_node],
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
                            // TODO: Reattach to parent_node and update bindings.
                        } else {
                            render_context.component_id = binding.component_id;
                            console.log('updating binding', binding, 'against context', render_context);
                            var { post_render } = render_ml(binding.ml, render_context, binding);
                            // TODO: Handle post_render
                        }
                    });
                    dom_detach_alt_nodes(cxt_bindings, ky);
                } else if (is_defined(state[ky])) {
                    dom_detach_alt_nodes(cxt_bindings, null);
                    Object.values(cxt_bindings.null.$bindings).forEach(binding => {
                        if (binding.is_rendered) {
                            binding.nodes.forEach(node => {
                                binding.parent_node.appendChild(node);
                            });
                        } else {
                            render_context.component_id = binding.component_id;
                            var { post_render } = render_ml(binding.ml, render_context, binding);
                            // TODO: Handle post_render
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
