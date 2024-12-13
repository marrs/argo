var reactor = (function() {
    var listeners = {};
    return {
        on: (evt, fn) => {
            if (!listeners[evt]) {
                listeners[evt] = [];
            }
            listeners[evt].push(fn);
        },
        fire: (evt, payload) => {
            if (listeners[evt]) {
                listeners[evt].forEach(fn => {
                    fn(payload);
                });
            }
        },
    };
}())

export default reactor;
