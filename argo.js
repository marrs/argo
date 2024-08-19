function html(ml) {
    if (!Array.isArray(ml)) {
        throw new Error("jsonML must be an array.")
    }

    if (!ml.length) {
        return "";
    }

    var target = [];

    var first = ml[0];
    var second = ml[1];
    var rest = ml.slice(2);

    var tag = null;
    var attr = '';

    if (Array.isArray(first)) {
        target.push(html(first));
    } else if (typeof first === 'string') {
        tag = '<' + first;
    } else if (typeof first === 'function') {
        console.log("TODO: handle components");
    } else {
        throw new Error("Illegal element in first position");
    }

    if (Object.prototype.toString.call(second) === '[object Object]') {
        console.log("TODO: Handle attributes");
    } else {
        tag && target.push(tag += '>');
        if (Array.isArray(second)) {
            target.push(html(second));
        } else {
            second && target.push(second.toString());
        }
    }

    if (rest.length) {
        for (var idx = 0, len = rest.length; idx < len; ++idx) {
            if (Array.isArray(rest[idx])) {
                target.push(html(rest[idx]));
            } else {
                target.push(rest[idx].toString()); // TODO: Validate
            }
        }
    }
    
    if (second && typeof first === 'string') {
        target.push('</' + first + '>');
    }
    return target.join('');
}

var argo = {
    html,
}

window.argo = argo;
