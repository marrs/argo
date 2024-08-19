function type(x) {
    return Object.prototype.toString.call(x);
}

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
        target.push(html(first(second)));
        second = null;
        if (rest.length) {
            throw new Error("Too many args", first);
        }
    } else {
        throw new Error("Illegal element in first position");
    }

    if (type(second) === '[object Object]') {
        Object.keys(second).map((ky) => {
            var vl = second[ky];
            switch(type(vl)) {
                case '[object String]': {
                    attr = ky + '="' + vl + '"';
                } break;
                case '[object Boolean]': {
                    if (vl) {
                        attr = ky + '="' + ky + '"';
                    }
                } break;
                case '[object Object]': {
                    if ('style' === ky) {
                        attr = ky + '="' + Object.keys(vl).map((ky) => ky + ':' + vl[ky]).join(';') + '"';
                    }
                }
            }
            return ky + '=' + '"';
        });
        tag += attr? ' ' + attr + '>' : '>';
        target.push(tag);
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
    
    if (rest.length
    || second !== undefined
    && second !== null
    && type(second) !== '[object Object]'
    && typeof first === 'string') {
        target.push('</' + first + '>');
    }
    return target.join('');
}

var argo = {
    html,
}

argo.html = html;

window.argo = argo;
